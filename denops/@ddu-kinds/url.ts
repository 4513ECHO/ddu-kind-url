/**
 * URL kind for ddu.vim.
 * Please read {@link https://github.com/4513ECHO/ddu-kind-url/blob/main/doc/ddu-kind-url.txt help} for details.
 *
 * @example
 * ```vim
 * " Set kind default action.
 * call ddu#custom#patch_global('kindOptions', {
 *     \ 'url': {
 *     \   'defaultAction': 'browse',
 *     \ },
 *     \ })
 * ```
 * @module
 */

import * as fn from "jsr:@denops/std@^7.1.1/function";
import {
  type ActionCallback,
  ActionFlags,
  type Actions,
  type BaseParams,
  type Item,
} from "jsr:@shougo/ddu-vim@^6.0.0/types";
import { BaseKind } from "jsr:@shougo/ddu-vim@^6.0.0/kind";
import { deepMerge } from "jsr:@std/collections@^1.0.5/deep-merge";
import { TextLineStream } from "jsr:@std/streams@^1.0.3/text-line-stream";
import { systemopen } from "jsr:@lambdalisue/systemopen@^1.0.0";

/** Action data of URL kind */
export interface ActionData {
  /** URL of the item */
  url?: string;
}
/** kindParams of ddu-kind-url */
export interface Params extends BaseParams {
  /**
   * The method to use external browser in {@link UrlActions.browse}.
   * Following values are available:
   * |value          |description                                                                     |
   * |:-------------:|--------------------------------------------------------------------------------|
   * |`"openbrowser"`|Use {@link https://github.com/tyru/open-browser.vim openbrowser.vim}            |
   * |`"external"`   |Use {@link https://github.com/itchyny/vim-external vim-external}                |
   * |`"systemopen"` |Use {@link https://jsr.io/@lambdalisue/systemopen `jsr:@lambdalisue/systemopen`}|
   * |`"uiopen"`     |Use `vim.ui.open()` (Neovim only)                                               |
   */
  externalOpener: "openbrowser" | "external" | "systemopen" | "uiopen";
}
/** actionParams used in {@link UrlActions.fetch} */
export interface FetchParams {
  /** Optional body of request (default: `null`) */
  body: string | null;
  /** Headers of request (default: `{}`) */
  headers: Record<string, string>;
  /** HTTP method of request (default: `"GET"`) */
  method: string;
  /** Whether to show response headers (default: `true`) */
  showHeader: boolean;
  /** Whether to show response status (default: `true`) */
  showStatus: boolean;
}
/** Implemention of actions of URL kind */
export interface UrlActions extends Actions<Params> {
  /**
   * Browse the URLs using external browser.
   * {@link Params.externalOpener} is used to detect the method to open external browser.
   */
  browse: ActionCallback<Params>;
  /**
   * Request to the URLs and show the result in scratch buffer.
   */
  fetch: ActionCallback<Params>;
  /**
   * Open the URLs as vim buffer.
   * This will be useful when you use plugins that can treat the URLs as vim buffer,
   * like `netrw` or {@link https://github.com/lambdalisue/vim-protocol vim-protocol}.
   */
  open: ActionCallback<Params>;
  /**
   * Yank the URLs.
   * If you select multiple items, URLs are yanked as joined with newline.
   * This action doesn't quit the ddu ui.
   */
  yank: ActionCallback<Params>;
}

function getUrl(item: Item): string {
  return (item?.action as ActionData | undefined)?.url ?? item.word;
}

function capitalize(str: string): string {
  return str.replace(
    /\w+/g,
    (match) => match[0]?.toUpperCase() + match.slice(1).toLowerCase(),
  );
}

export const UrlActions: UrlActions = {
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
    const params = deepMerge<Partial<FetchParams>>(
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
  override actions: UrlActions = UrlActions;

  override params(): Params {
    return {
      externalOpener: "systemopen",
    };
  }
}
