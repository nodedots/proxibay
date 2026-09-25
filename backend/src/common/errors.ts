import { HttpException, HttpStatus } from '@nestjs/common';

export function err(status: number, code: string, message: string): never {
  throw new HttpException({ error: { code, message } }, status as HttpStatus);
}
