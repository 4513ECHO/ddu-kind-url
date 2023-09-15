import * as fn from "https://deno.land/x/denops_std@v5.0.1/function/mod.ts";
import type {
  Actions,
  Item,
} from "https://deno.land/x/ddu_vim@v3.6.0/types.ts";
import {
  ActionFlags,
  BaseKind,
} from "https://deno.land/x/ddu_vim@v3.6.0/types.ts";
import { deepMerge } from "https://deno.land/std@0.201.0/collections/deep_merge.ts";
import { TextLineStream } from "https://deno.land/std@0.201.0/streams/text_line_stream.ts";
import { systemopen } from "https://deno.land/x/systemopen@v0.2.0/mod.ts";

export type ActionData = {
  url?: string;
};
export type Params = {
  externalOpener: "openbrowser" | "external" | "systemopen" | "uiopen";
};
export type FetchParams = {
  body: string | null;
  headers: Record<string, string>;
  method: string;
  showHeader: boolean;
  showStatus: boolean;
};

function getUrl(item: Item): string {
  return (item?.action as ActionData | undefined)?.url ?? item.word;
}

function capitalize(str: string): string {
  return str.replace(
    /\w+/g,
    (match) => match[0].toUpperCase() + match.slice(1).toLowerCase(),
  );
}

export const UrlActions = {
  async browse(args) {
    switch (args.kindParams.externalOpener) {
      case "openbrowser":
        for (const item of args.items) {
          await args.denops.call("openbrowser#open", getUrl(item));
        }
        break;
      case "external":
        for (const item of args.items) {
          await args.denops.call("external#browser", getUrl(item));
        }
        break;
      case "systemopen":
        for (const item of args.items) {
          await systemopen(getUrl(item));
        }
        break;
      case "uiopen":
        for (const item of args.items) {
          await args.denops.call("luaeval", "vim.ui.open(_A)", getUrl(item));
        }
        break;
      default:
        await args.denops.call(
          "ddu#util#print_error",
          `Invalid externalOpener: ${args.kindParams.externalOpener}`,
          "ddu-kind-url",
        );
    }
    return ActionFlags.None;
  },

  async open(args) {
    const params = args.actionParams as { command?: string };
    for (const item of args.items) {
      await args.denops.cmd("silent execute command fnameescape(path)", {
        command: params.command ?? ":edit",
        path: getUrl(item),
      });
    }
    return ActionFlags.None;
  },

  async yank(args) {
    const { register } = args.actionParams as { register?: string };
    await fn.setreg(
      args.denops,
      register ?? await args.denops.eval("v:register"),
      args.items.map(getUrl),
    );
    return ActionFlags.Persist;
  },

  async fetch(args) {
    const params = deepMerge<FetchParams>(
      args.actionParams as Partial<FetchParams>,
      {
        body: null,
        headers: {},
        method: "GET",
        showHeader: true,
        showStatus: true,
      },
    );
    for (const item of args.items) {
      const response = await fetch(getUrl(item), {
        body: params.body,
        headers: params.headers,
        method: params.method,
      });
      const content: string[] = [];

      if (params.showStatus) {
        content.push(`${response.status} ${response.statusText}`);
        content.push("");
      }
      if (params.showHeader) {
        for await (const [key, value] of response.headers.entries()) {
          content.push(`${capitalize(key)}: ${value}`);
        }
        content.push("");
      }
      if (response.body) {
        const stream = response.body
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(new TextLineStream());
        for await (const line of stream) {
          content.push(line);
        }
      }

      await args.denops.cmd(
        "new +setlocal\\ buftype=nofile ddu-kind-url-fetch",
      );
      await args.denops.call("setline", 1, content);
    }
    return ActionFlags.None;
  },
} as const satisfies Actions<Params>;

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = UrlActions;

  override params(): Params {
    return {
      externalOpener: "systemopen",
    };
  }
}
