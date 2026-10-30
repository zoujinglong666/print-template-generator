/** 标签模板示例数据（print-canvas-designer 的 field 绑定） */
export const mockLabelData: Record<string, unknown> = {
  sku: 'CMNWCAO0OBCN3260',
  productName: '双肩包 K7J30006 WYT16 浅棕色',
  spec: '12900H+(16+16)+1TB',
  qty: 1,
  warehouse: '维修良品仓',
  boxNo: 'FBDC011160-001',
  barcode: '6901234567890',
  qrcode: 'FBDC011160-001|CMNWCAO0OBCN3260|1',
  printDate: '2026-09-16 11:08:27'
}

/** 示例打印数据：模拟后端接口返回，字段路径与模板占位符一一对应 */
export const mockPrintData: Record<string, unknown> = {
  title: '分步式调出单',
  orgName: '国内电商',
  orderStatus: '审核中',
  orderCode: 'FBDC011160',
  outWarehouse: '供应商维修仓',
  outDate: '2026/9/16',
  outType: '标准分步式调出单',
  creator: '尹莉',
  reviewer: '',
  acceptor: '',
  printDate: '2026-09-16 11:08:27',
  details: [
    {
      sku: 'CMNWCAO0OBCN3260',
      productName: '双肩包_K7J30006_WYT16_浅棕色 中规 (ACEMAGIC) Win11_PRO系统',
      spec: '12900H+(16+16)+1TB',
      unit: 'Pes',
      qty: 1,
      outWarehouse: '维修良品仓',
      inWarehouse: '',
      remark: ''
    },
    {
      sku: 'CMNWCAO0OBCN3261',
      productName: '机械键盘_KX8200_WYT21_黑色',
      spec: '87键+RGB',
      unit: 'Pes',
      qty: 2,
      outWarehouse: '维修良品仓',
      inWarehouse: '',
      remark: ''
    }
  ]
}
