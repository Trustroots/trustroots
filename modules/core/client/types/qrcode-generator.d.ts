declare module 'qrcode-generator' {
  type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

  type QRCode = {
    addData(data: string): void;
    make(): void;
    createDataURL(cellSize?: number): string;
  };

  function qrcode(
    typeNumber: number,
    errorCorrectionLevel: ErrorCorrectionLevel,
  ): QRCode;

  export default qrcode;
}
