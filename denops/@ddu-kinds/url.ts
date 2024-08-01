import * as fn from "jsr:@denops/std@^7.0.1/function";
import {
  ActionFlags,
  type Actions,
  type Item,
} from "jsr:@shougo/ddu-vim@^5.0.0/types";
import { BaseKind } from "jsr:@shougo/ddu-vim@^5.0.0/kind";
import { deepMerge } from "jsr:@std/collections@^1.0.5/deep-merge";
import { TextLineStream } from "jsr:@std/streams@^1.0.0/text-line-stream";
import { systemopen } from "jsr:@lambdalisue/systemopen@^1.0.0";

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
    (match) => match[0]?.toUpperCase() + match.slice(1).toLowerCase(),
  );
}

export const UrlActions: Actions<Params> = {
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
        content.push(`${response.status} ${response.statusText}`, "");
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
        content.push(...await Array.fromAsync(stream));
      }

      await args.denops.cmd(
        "new +setlocal\\ buftype=nofile ddu-kind-url-fetch",
      );
      await args.denops.call("setline", 1, content);
    }
    return ActionFlags.None;
  },
};

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = UrlActions;

  override params(): Params {
    return {
      externalOpener: "systemopen",
    };
  }
}
