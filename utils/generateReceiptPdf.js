const path = require('path');
const pdfmake = require('pdfmake');

const fonts = {
  Roboto: {
    normal: path.join(__dirname, '../node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf'),
    bold: path.join(__dirname, '../node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf'),
    italics: path.join(__dirname, '../node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, '../node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf')
  }
};

pdfmake.setFonts(fonts);
pdfmake.setUrlAccessPolicy(() => true);
pdfmake.setLocalAccessPolicy(() => true);

/**
 * Generates an itemized receipt PDF buffer
 * @param {Object} data 
 * @returns {Promise<Buffer>}
 */
async function generateReceiptPdf({
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  shippingStreet,
  shippingCity,
  shippingProvince,
  shippingZip,
  datePlaced,
  dateShipped,
  statusName,
  paymentMethod,
  paymentStatus,
  transactionRef,
  items,
  subtotal,
  shippingFee,
  grandTotal,
  storeName
}) {
  const paymentLabels = {
    cod: 'Cash on Delivery (COD)',
    gcash: 'GCash',
    card: 'Credit / Debit Card',
    bank_transfer: 'Bank Transfer'
  };
  const paymentLabel = paymentLabels[paymentMethod] || paymentMethod || 'COD';

  // Build item rows for pdfmake table
  const itemRows = [
    [
      { text: 'Item Description', bold: true, fillColor: '#1a1a2e', color: '#ffffff' },
      { text: 'Price', bold: true, fillColor: '#1a1a2e', color: '#ffffff', alignment: 'right' },
      { text: 'Qty', bold: true, fillColor: '#1a1a2e', color: '#ffffff', alignment: 'center' },
      { text: 'Subtotal', bold: true, fillColor: '#1a1a2e', color: '#ffffff', alignment: 'right' }
    ]
  ];

  (items || []).forEach(item => {
    const price = parseFloat(item.price || item.sell_price || 0);
    const qty = parseInt(item.quantity || 1);
    itemRows.push([
      item.name || '',
      { text: '₱ ' + price.toLocaleString('en-PH', { minimumFractionDigits: 2 }), alignment: 'right' },
      { text: String(qty), alignment: 'center' },
      { text: '₱ ' + (price * qty).toLocaleString('en-PH', { minimumFractionDigits: 2 }), alignment: 'right' }
    ]);
  });

  const customerStack = [
    { text: 'CUSTOMER & SHIPPING', style: 'sectionLabel' },
    { text: customerName || 'Guest Customer', bold: true, fontSize: 10 },
    { text: `${shippingStreet || ''}, ${shippingCity || ''}`, fontSize: 9, color: '#555' },
    { text: `${shippingProvince || ''} ${shippingZip || ''}`, fontSize: 9, color: '#555' },
    { text: 'Email: ' + (customerEmail || ''), fontSize: 9, color: '#555' }
  ];

  if (customerPhone) {
    customerStack.push({ text: 'Phone: ' + customerPhone, fontSize: 9, color: '#555' });
  }

  const docDefinition = {
    content: [
      { text: (storeName || 'Tunify').toUpperCase(), style: 'header' },
      { text: 'Order Receipt', style: 'subheader' },
      { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: '#c8a96e' }] },
      { text: ' ' },
      {
        columns: [
          {
            width: '50%',
            stack: customerStack
          },
          {
            width: '50%',
            stack: [
              { text: 'ORDER DETAILS', style: 'sectionLabel' },
              { text: 'Order ID: ' + String(orderId), fontSize: 10, bold: true },
              { text: 'Date Placed: ' + (datePlaced ? new Date(datePlaced).toLocaleDateString('en-US') : ''), fontSize: 9, color: '#555' },
              { text: 'Date Shipped: ' + (dateShipped ? new Date(dateShipped).toLocaleDateString('en-US') : 'Processing'), fontSize: 9, color: '#555' },
              { text: 'Status: ' + (statusName || ''), fontSize: 9, color: '#555' },
              { text: 'Payment: ' + paymentLabel, fontSize: 9, color: '#555' },
              { text: 'Payment Status: ' + (paymentStatus || 'Pending'), fontSize: 9, color: '#555' },
              ...(transactionRef ? [{ text: 'Ref No: ' + transactionRef, fontSize: 9, color: '#555' }] : [])
            ]
          }
        ]
      },
      { text: ' ' },
      { text: 'ORDER ITEMS', style: 'sectionLabel' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 100, 50, 100],
          body: itemRows
        },
        layout: 'lightHorizontalLines'
      },
      { text: ' ' },
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 250,
            table: {
              widths: ['*', 'auto'],
              body: [
                ['Subtotal', { text: '₱ ' + parseFloat(subtotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }), alignment: 'right' }],
                ['Shipping Fee', { text: '₱ ' + parseFloat(shippingFee || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }), alignment: 'right' }],
                [
                  { text: 'Grand Total', bold: true, fontSize: 11 },
                  { text: '₱ ' + parseFloat(grandTotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }), bold: true, fontSize: 11, alignment: 'right', color: '#c8a96e' }
                ]
              ]
            },
            layout: 'lightHorizontalLines'
          }
        ]
      },
      { text: ' ' },
      { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.5, lineColor: '#cccccc' }] },
      { text: `Thank you for shopping with ${storeName || 'Tunify'}!`, alignment: 'center', italics: true, fontSize: 9, color: '#777', margin: [0, 8, 0, 0] }
    ],
    styles: {
      header: { fontSize: 22, bold: true, alignment: 'center', color: '#c8a96e', margin: [0, 0, 0, 4] },
      subheader: { fontSize: 12, alignment: 'center', color: '#555', margin: [0, 0, 0, 8] },
      sectionLabel: { fontSize: 8, bold: true, color: '#888', margin: [0, 0, 0, 4] }
    },
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#222' }
  };

  const pdfDoc = pdfmake.createPdf(docDefinition);
  return await pdfDoc.getBuffer();
}

module.exports = generateReceiptPdf;
