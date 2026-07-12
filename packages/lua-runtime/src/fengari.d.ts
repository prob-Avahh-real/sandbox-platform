declare module 'fengari' {
  export const lauxlib: any;
  export const lualib: any;
  export const lua: any;
  export function to_luastring(s: string): any;
  export function to_jsstring(s: any): string;
  export function tojs(L: any, idx?: number): any;
  export function tolua(L: any, v: any): void;
}
