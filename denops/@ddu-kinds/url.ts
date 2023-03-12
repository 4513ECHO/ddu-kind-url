import * as fn from "https://deno.land/x/denops_std@v4.0.0/function/mod.ts";
import type {
  Actions,
  Item,
} from "https://deno.land/x/ddu_vim@v2.3.0/types.ts";
import {
  ActionFlags,
  BaseKind,
} from "https://deno.land/x/ddu_vim@v2.3.0/types.ts";
import { TextLineStream } from "https://deno.land/std@0.178.0/streams/text_line_stream.ts";

export interface ActionData {
  url?: string;
}
type Params = {
  externalOpener: "openbrowser" | "external";
};
interface FetchParams {
  showHeader?: boolean;
  body?: string;
  method?: string;
}

function getUrl(item: Item): string {
  return (item?.action as ActionData | undefined)?.url ?? item.word;
}

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
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
      const content = args.items.map(getUrl).join("\n");
      await fn.setreg(
        args.denops,
        register ?? await args.denops.eval("v:register"),
        content,
      );
      return ActionFlags.Persist;
    },

    async fetchUnstable(args) {
      const params = args.actionParams as FetchParams;
      for (const item of args.items) {
        const response = await fetch(getUrl(item), {
          body: params.body,
          method: params.method ?? "GET",
        });

        const header: string[] = [];
        if (params.showHeader) {
          header.push(`HTTP/1.1 ${response.status} ${response.statusText}`);
          for await (const [key, value] of response.headers.entries()) {
            header.push(`${key}: ${value}`);
          }
          header.push("");
        }

        const body: string[] = [];
        const bodyRaw = response.body;
        if (bodyRaw !== null) {
          const stream = bodyRaw
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new TextLineStream());
          for await (const line of stream) {
            body.push(line);
          }
        }

        const content = header.concat(body);
        await args.denops.cmd("new +setlocal\\ buftype=nofile");
        await args.denops.call("setline", 1, content);
      }
      return ActionFlags.None;
    },
  };

  override params(): Params {
    return {
      externalOpener: "openbrowser",
    };
  }
}
