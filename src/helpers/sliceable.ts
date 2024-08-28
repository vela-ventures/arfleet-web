import { concatBuffers } from "./buf";
import { readFileChunk } from "./buf";
import { downloadUint8ArrayAsFile } from "./extra";

/*
*   Slice(start, end) means:
*
*   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
*           ^--^--^--\
*   slice(2, 5) => [ 2, 3, 4 ]
* 
*   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
*                             ^--^--\
*   slice(8, 10) => [ 8, 9 ]
* 
*   end-th index is excluded
*/

export type SliceLength = number;
export type SlicePart = [SliceLength, (
    Uint8Array
    | File
    | (() => Uint8Array)
    | (() => Promise<Uint8Array>)
    | ((start: number, end: number) => Uint8Array)
    | ((start: number, end: number) => Promise<Uint8Array>)
    | Sliceable
)];
export type SliceParts = SlicePart[];

const log = (...args: any[]) => (true) ? console.log('[Sliceable]', ...args) : null;

export abstract class Sliceable {
    partsCached: SliceParts | null = null;
    byteLengthCached: number | null = null;

    log: (...args: any[]) => void;

    constructor(...args: any[]) {
      this.log = log;
    }

    async getParts(): Promise<SliceParts> {
        if (this.partsCached !== null) return this.partsCached;
        return this.partsCached = await this.buildParts();
    }

    async getByteLength(): Promise<number> {
        if (this.byteLengthCached !== null) return this.byteLengthCached;
        const parts = await this.getParts();
        return this.byteLengthCached = parts.reduce((acc, [length, _]) => acc + length, 0);
    }

    async slice(start: number, end: number): Promise<Uint8Array> {
        if (start < 0 || end < 0 || start > end) throw new Error(`Invalid slice: start=${start}, end=${end}`);

        const parts = await this.getParts();

        if (this.byteLengthCached === null) throw new Error('Byte length not cached yet, but we just built parts');
        if (start >= this.byteLengthCached) throw new Error(`Invalid slice idx: start=${start} is greater than or equal to byte length=${this.byteLengthCached}`);
        if (end > this.byteLengthCached) throw new Error(`Invalid slice idx: end=${end} is greater than byte length=${this.byteLengthCached}`);

        let result: Uint8Array[] = [];
        let currentPosition = 0;
      
        for (const part of parts) {
          const [ length, bytes ] = part;
      
          if (length < 0) throw new Error("Invalid part length");
      
          const partStart = currentPosition;
          const partEnd = currentPosition + length;
      
          if (partEnd > start && partStart < end) {
            const sliceStart = Math.max(0, start - partStart);
            const sliceEnd = Math.min(length, end - partStart);
      
            if (typeof bytes === 'function') {
              if (isTwoParamFunction(bytes)) {
                result.push(await bytes(sliceStart, sliceEnd));
              } else if (isNoParamFunction(bytes)) {
                result.push((await bytes()).slice(sliceStart, sliceEnd));
              } else {
                throw new Error('Invalid function type for bytes');
              }
            } else if (bytes instanceof Uint8Array) {
              result.push(bytes.slice(sliceStart, sliceEnd));
            } else if (bytes instanceof File) {
              result.push(await readFileChunk(bytes, sliceStart, sliceEnd));
            } else if (bytes instanceof Sliceable) {
              result.push(await bytes.slice(sliceStart, sliceEnd));
            } else {
              throw new Error('Invalid type for bytes');
            }
          }
      
          currentPosition += length;
          if (currentPosition >= end) break;
        }
        
        return concatBuffers(result);
    }

    async downloadAsFile(filename: string): Promise<void> {
      await downloadUint8ArrayAsFile(new Uint8Array(await this.slice(0, await this.getByteLength())), filename);
    }

    abstract buildParts(): Promise<SliceParts>;
}

function isTwoParamFunction(func: any): func is (start: number, end: number) => Promise<Uint8Array> {
  return typeof func === 'function' && func.length === 2;
}

function isNoParamFunction(func: any): func is () => Promise<Uint8Array> {
  return typeof func === 'function' && func.length === 0;
}