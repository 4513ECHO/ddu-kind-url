import * as fn from "https://deno.land/x/denops_std@v3.2.0/function/mod.ts";
import type { Actions } from "https://deno.land/x/ddu_vim@v1.3.0/types.ts";
import {
  ActionFlags,
  BaseKind,
} from "https://deno.land/x/ddu_vim@v1.3.0/types.ts";

export interface ActionData {
  url: string;
}
type Params = Record<never, never>;
interface OpenParams {
  command?: string;
}

export class Kind extends BaseKind<Params> {
  actions: Actions<Params> = {
    async browse(args) {
      for (const item of args.items) {
        const action = item?.action as ActionData;
        if (await fn.exists(args.denops, "g:loaded_openbrowser")) {
          await args.denops.call("openbrowser#open", action.url);
        } else {
          await args.denops.call("ddu#util#open", action.url);
        }
      }
      return Promise.resolve(ActionFlags.None);
    },
    async open(args) {
      const params = args.actionParams as OpenParams;
      const openCommand = params.command ?? "edit";
      for (const item of args.items) {
        const action = item?.action as ActionData;
        await args.denops.cmd("silent execute command fnameescape(path)", {
          command: openCommand,
          path: action.url,
        });
      }
      return Promise.resolve(ActionFlags.None);
    },
    async yank(args) {
      for (const item of args.items) {
        const action = item?.action as ActionData;
        await fn.setreg(args.denops, '"', action.url);
        if (await fn.has(args.denops, "clipboard")) {
          await fn.setreg(
            args.denops,
            await args.denops.eval("v:register"),
            action.url,
          );
        }
      }
      return Promise.resolve(ActionFlags.None);
    },
  };

  params(): Params {
    return {};
  }
}
