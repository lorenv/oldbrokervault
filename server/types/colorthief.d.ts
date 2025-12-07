declare module 'colorthief' {
  export function getColor(
    img: Buffer | string,
    quality?: number
  ): Promise<[number, number, number]>;

  export function getPalette(
    img: Buffer | string,
    colorCount?: number,
    quality?: number
  ): Promise<[number, number, number][]>;
}
