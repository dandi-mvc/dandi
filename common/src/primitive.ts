import { DateTime } from 'luxon'

import { Currency } from './currency'
import { Url } from './url'
import { Uuid } from './uuid'

export type PrimitiveType = Boolean | Currency | DateTime | Number | String | Url | Uuid

export function isPrimitiveType(type: any): type is PrimitiveType {
  return (
    type === Boolean ||
    type === Currency ||
    type === DateTime ||
    type === Number ||
    type === Primitive ||
    type === String ||
    type === Url ||
    type === Uuid
  )
}

export class Primitive<T extends PrimitiveType> {
  constructor(public readonly value: T) {}
}
