const decoder = new TextDecoder("utf-8");

export class Cursor {
  private readonly view: DataView;
  private pos = 0;

  constructor(buffer: ArrayBuffer, byteOffset = 0, byteLength?: number) {
    this.view = new DataView(buffer, byteOffset, byteLength);
  }

  u8(): number {
    const v = this.view.getUint8(this.pos);
    this.pos += 1;
    return v;
  }

  u16(): number {
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }

  u32(): number {
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }

  i32(): number {
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }

  f32(): number {
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }

  string(): string {
    const len = this.u16();
    const bytes = new Uint8Array(
      this.view.buffer,
      this.view.byteOffset + this.pos,
      len,
    );
    this.pos += len;
    return decoder.decode(bytes);
  }
}
