# ddu-kind-url

URL kind for ddu.vim

This kind implements URL operations.

Please read [help](doc/ddu-kind-url.txt) for details.

## Requirements

- [denops.vim](https://github.com/vim-denops/denops.vim)
- [ddu.vim](https://github.com/Shougo/ddu.vim)

Optional dependencies:

- [tyru/open-browser.vim](https://github.com/tyru/open-browser.vim)
- [itchyny/vim-external](https://github.com/itchyny/vim-external)
- [lambdalisue/vim-protocol](https://github.com/lambdalisue/vim-protocol)

## Configuration

```vim
" Set kind default action.
call ddu#custom#patch_global('kindOptions', {
      \ 'url': {
      \   'defaultAction': 'browse',
      \ },
      \ })
```

## Use from deno

You can import types from [pax.deno.dev](https://pax.deno.dev):

```typescript
import type { ActionData } from "https://pax.deno.dev/4513ECHO/ddu-kind-url@$VERSION/denops/@ddu-kinds/url.ts"
```
