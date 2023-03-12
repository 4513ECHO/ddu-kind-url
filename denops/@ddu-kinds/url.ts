import * as fn from "https://deno.land/x/denops_std@v4.0.0/function/mod.ts";
import type {
  Actions,
  Item,
} from "https://deno.land/x/ddu_vim@v2.3.0/types.ts";
import {
  ActionFlags,
  BaseKind,
} from "https://deno.land/x/ddu_vim@v2.3.0/types.ts";

export interface ActionData {
  url: string;
}
type Params = {
  externalOpener: "openbrowser" | "external";
};

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
      const content = args.items
        .map((item) => getUrl(item))
        .join("\n");
      await fn.setreg(
        args.denops,
        register ?? await args.denops.eval("v:register"),
        content,
      );
      return ActionFlags.Persist;
    },
  };

  override params(): Params {
    return {
      externalOpener: "openbrowser",
    };
  }
}
