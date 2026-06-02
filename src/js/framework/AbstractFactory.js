import { NotImplementedError } from "../errors/NotImplementedError.js";

/**
 * Optional factory base for envelope `data` -> domain object conversion.
 * Most of this app keeps `data` as plain JSON; factories are only used where we
 * need to normalize/coerce values (e.g. timestamps, big-int strings).
 */
export class AbstractFactory {
  /**
   * @param {object} _raw
   * @returns {object}
   */
  make(_raw) {
    throw new NotImplementedError(`${this.constructor.name}.make`);
  }

  /**
   * @param {object[]} list
   * @returns {object[]}
   */
  parseList(list) {
    return list.map((item) => this.make(item));
  }
}
