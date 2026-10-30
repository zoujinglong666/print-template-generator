/** printRuntime.js 的类型声明（该文件为纯 JS 自包含运行时，供 ?raw 内联） */
export declare function __peRuntime(schema: unknown, data: unknown, ph?: boolean): string;
export declare function __peBarcodeSvg(
  value: string,
  format: string,
  opts?: { showText?: boolean; fontSize?: number }
): { svg: string; error?: string };
export declare function __peQrSvg(value: string, ecl?: string): { svg: string; error?: string };
export declare function __peBarcodeBits(value: string, format: string): { bits: string; error?: string };
