declare module '@mapbox/polyline' {
  export function decode(str: string, precision?: number): [number, number][];
  export function encode(coords: [number, number][], precision?: number): string;
  const polyline: { decode: typeof decode; encode: typeof encode };
  export default polyline;
}
