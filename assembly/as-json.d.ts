declare module 'as-json' {
  /**
   * Decorator for serializable classes.
   */
  export function serializable(constructor: any): any;

  export namespace JSON {
    /**
     * Stringifies a given value.
     * @param data T
     */
    export function stringify<T>(data: T): string;
    /**
     * Parses a given string.
     * @param data string
     */
    export function parse<T>(data: string): T;
  }
}