/** jsbarcode / qrcode 无官方类型声明，最小化声明（label-kit 自含，不依赖 @types 包） */
declare module 'jsbarcode' {
  interface JsBarcodeOptions {
    format?: string
    displayValue?: boolean
    fontSize?: number
    font?: string
    height?: number
    width?: number
    margin?: number
    lineColor?: string
    background?: string
    textAlign?: string
    textPosition?: string
    textMargin?: number
    valid?: (valid: boolean) => void
  }
  function JsBarcode(element: SVGElement | HTMLCanvasElement | string, text: string, options?: JsBarcodeOptions): void
  export default JsBarcode
}

declare module 'qrcode' {
  interface QRCodeToCanvasOptions {
    width?: number
    margin?: number
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    color?: { dark?: string; light?: string }
  }
  interface QRCodeToStringOptions {
    type?: 'svg' | 'utf8' | 'terminal'
    margin?: number
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    color?: { dark?: string; light?: string }
  }
  export function toCanvas(canvas: HTMLCanvasElement, text: string, options?: QRCodeToCanvasOptions): Promise<void>
  export function toString(text: string, options?: QRCodeToStringOptions): Promise<string>
}
