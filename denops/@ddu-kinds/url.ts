import * as fn from "https://deno.land/x/denops_std@v4.0.0/function/mod.ts";
import type { Actions } from "https://deno.land/x/ddu_vim@v2.3.0/types.ts";
import {
  ActionFlags,
  BaseKind,
} from "https://deno.land/x/ddu_vim@v2.3.0/types.ts";

export interface ActionData {
  url: string;
}
type Params = {
  externalOpener: "openbrowser";
};

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    async browse(args) {
      switch (args.kindParams.externalOpener) {
        case "openbrowser":
          for (const item of args.items) {
            const action = item?.action as ActionData;
            await args.denops.call("openbrowser#open", action.url);
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
        const action = item?.action as ActionData;
        await args.denops.cmd("silent execute command fnameescape(path)", {
          command: params.command ?? ":edit",
          path: action.url,
        });
      }
      return ActionFlags.None;
    },

    async yank(args) {
      const { register } = args.actionParams as { register?: string };
      const content = args.items
        .map((item) => (item?.action as ActionData).url)
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
