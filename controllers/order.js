const db = require("../models");
const sendEmail = require('../utils/sendEmail');
const generateReceiptPdf = require('../utils/generateReceiptPdf');

// ── Receipt HTML builder (shared by placeOrder + updateOrderStatus) ──────────
function buildReceiptHtml({ orderId, customerName, customerEmail, customerPhone, shippingStreet, shippingCity, shippingProvince, shippingZip, datePlaced, dateShipped, statusName, paymentMethod, paymentStatus, transactionRef, items, subtotal, shippingFee, grandTotal, headerTitle, headerSubtitle, storeName, storeEmail = '', storePhone = '' }) {
  const paymentLabels = { cod: 'Cash on Delivery (COD)', gcash: 'GCash', card: 'Credit / Debit Card', bank_transfer: 'Bank Transfer' };
  const paymentLabel = paymentLabels[paymentMethod] || paymentMethod || 'COD';
  
  // Custom status color scheme based on the Sunset Amber & Rose Gold palette
  const statusColors = { 
    Pending: '#EAB308',     // Warm Amber
    Processing: '#C084FC',  // Soft Violet
    Shipped: '#FB7185',     // Rose Gold
    Delivered: '#10B981',   // Emerald Green
    Cancelled: '#F43F5E'    // Deep Rose / Red
  };
  const statusColor = statusColors[statusName] || '#94A3B8';

  const itemRows = (items || []).map(item => {
    const price = parseFloat(item.price || item.sell_price || 0);
    const qty = parseInt(item.quantity || 1);
    const sub = price * qty;
    return `
      <tr>
        <td style="padding: 12px 14px; border-bottom: 1px solid #1A1324; color: #FFF5F5; font-size: 14px;">${item.name}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #1A1324; text-align: right; color: #CBD5E1; font-size: 14px;">&#8369;${price.toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #1A1324; text-align: center; color: #CBD5E1; font-size: 14px;">${qty}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #1A1324; text-align: right; font-weight: 600; color: #FB7185; font-size: 14px;">&#8369;${sub.toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
      </tr>`;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body {
      margin: 0; padding: 0; background-color: #040208; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#040208;font-family:'Inter', 'Segoe UI', Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#040208;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#100C16;border: 1px solid rgba(251, 113, 133, 0.15);border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.6);">

          <!-- Premium Header with Radial Gradient Feel -->
          <tr>
            <td style="background: linear-gradient(135deg, #1A1324 0%, #0A0710 100%); padding: 44px 40px; text-align: center; border-bottom: 1px solid rgba(251, 113, 133, 0.1);">
              <div style="font-size: 32px; font-weight: 800; color: #FBBF24; letter-spacing: 4px; text-shadow: 0 0 10px rgba(251, 191, 36, 0.2);">${(storeName || 'Tunify').toUpperCase()}</div>
              <div style="font-size: 12px; color: #FB7185; margin-top: 4px; letter-spacing: 2px; font-weight: 600; text-transform: uppercase;">Sunset Amber & Rose Gold</div>
              <div style="margin-top: 24px; font-size: 22px; font-weight: 700; color: #FFF5F5;">${headerTitle || 'Order Confirmation'}</div>
              <div style="margin-top: 8px; font-size: 14px; color: #CBD5E1;">${headerSubtitle || 'Thank you for your order!'}</div>
            </td>
          </tr>

          <!-- Order ID / Status Banner -->
          <tr>
            <td style="background: #1A1324; padding: 16px 40px; text-align: center; border-bottom: 1px solid rgba(251, 113, 133, 0.1);">
              <span style="font-size: 16px; font-weight: 700; color: #FBBF24; letter-spacing: 1px;">ORDER ${orderId}</span>
              ${statusName ? `&nbsp;&nbsp;<span style="border: 1px solid ${statusColor}; color: ${statusColor}; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: rgba(0,0,0,0.2);">${statusName.toUpperCase()}</span>` : ''}
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 36px 40px;">

              <!-- Customer & Shipping Information -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td width="50%" valign="top" style="padding-right: 20px;">
                    <div style="font-size: 11px; font-weight: 700; color: #94A3B8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px;">Customer Details</div>
                    <div style="font-size: 15px; font-weight: 700; color: #FFF5F5;">${customerName || 'Customer'}</div>
                    <div style="font-size: 13px; color: #CBD5E1; margin-top: 4px;">${customerEmail || ''}</div>
                    ${customerPhone ? `<div style="font-size: 13px; color: #CBD5E1; margin-top: 2px;">${customerPhone}</div>` : ''}
                  </td>
                  <td width="50%" valign="top" style="padding-left: 20px; border-left: 1px solid #1A1324;">
                    <div style="font-size: 11px; font-weight: 700; color: #94A3B8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px;">Shipping Destination</div>
                    <div style="font-size: 13.5px; color: #FFF5F5; line-height: 1.6;">
                      ${shippingStreet || ''}<br>
                      ${shippingCity || ''}, ${shippingProvince || ''} ${shippingZip || ''}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Order Specific Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px; border-top: 1px solid #1A1324; padding-top: 20px;">
                <tr>
                  <td width="33%" valign="top">
                    <div style="font-size: 11px; font-weight: 700; color: #94A3B8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px;">Date Placed</div>
                    <div style="font-size: 14px; color: #FFF5F5; font-weight: 600;">${datePlaced ? String(datePlaced).split('T')[0] : 'N/A'}</div>
                  </td>
                  <td width="33%" valign="top">
                    <div style="font-size: 11px; font-weight: 700; color: #94A3B8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px;">Date Shipped</div>
                    <div style="font-size: 14px; color: #FFF5F5; font-weight: 600;">${dateShipped ? String(dateShipped).split('T')[0] : 'Processing'}</div>
                  </td>
                  <td width="34%" valign="top">
                    <div style="font-size: 11px; font-weight: 700; color: #94A3B8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px;">Payment Method</div>
                    <div style="font-size: 14px; color: #FFF5F5; font-weight: 600; margin-bottom: 2px;">${paymentLabel}</div>
                    <div style="font-size: 11px; color: ${paymentStatus === 'paid' ? '#10B981' : '#EAB308'}; font-weight: 700; text-transform: uppercase;">
                      ${paymentStatus || 'PENDING'}${transactionRef ? ` &bull; ${transactionRef}` : ''}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Items Table Section -->
              <div style="font-size: 11px; font-weight: 700; color: #94A3B8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;">Purchased Items</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #1A1324; border-radius: 10px; overflow: hidden; margin-bottom: 24px; background-color: #0A0710;">
                <thead>
                  <tr style="background-color: #1A1324;">
                    <th style="padding: 12px 14px; text-align: left; font-size: 12px; color: #FB7185; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Item</th>
                    <th style="padding: 12px 14px; text-align: right; font-size: 12px; color: #FB7185; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Price</th>
                    <th style="padding: 12px 14px; text-align: center; font-size: 12px; color: #FB7185; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                    <th style="padding: 12px 14px; text-align: right; font-size: 12px; color: #FB7185; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>

              <!-- Financial Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                <tr>
                  <td colspan="2"><hr style="border: none; border-top: 1px solid #1A1324; margin: 0 0 16px;"></td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #94A3B8; padding: 4px 0;">Subtotal</td>
                  <td style="font-size: 14px; color: #FFF5F5; text-align: right; padding: 4px 0;">&#8369;${parseFloat(subtotal||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #94A3B8; padding: 4px 0;">Shipping & Handling</td>
                  <td style="font-size: 14px; color: #FFF5F5; text-align: right; padding: 4px 0;">&#8369;${parseFloat(shippingFee||100).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
                </tr>
                <tr>
                  <td colspan="2"><hr style="border: none; border-top: 1px solid rgba(251, 113, 133, 0.3); margin: 12px 0;"></td>
                </tr>
                <tr>
                  <td style="font-size: 18px; font-weight: 800; color: #FFF5F5;">Grand Total</td>
                  <td style="font-size: 20px; font-weight: 800; color: #FBBF24; text-align: right; text-shadow: 0 0 8px rgba(251, 191, 36, 0.15);">&#8369;${parseFloat(grandTotal||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Luxury Footer -->
          <tr>
            <td style="background-color: #0A0710; border-top: 1px solid rgba(251, 113, 133, 0.1); padding: 28px 40px; text-align: center;">
              <div style="font-size: 13px; color: #CBD5E1;">
                Questions about your order? Reply to this email or contact us at 
                <a href="mailto:${storeEmail || 'support@tunify.com'}" style="color: #FB7185; text-decoration: none; font-weight: 600;">${storeEmail || 'support@tunify.com'}</a>${storePhone ? ` &nbsp;·&nbsp; <span style="color:#94A3B8">${storePhone}</span>` : ''}
              </div>
              <div style="font-size: 11px; color: #94A3B8; margin-top: 10px;">
                &copy; 2026 ${storeName || 'Tunify'} Music Store. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// 1. GET ALL ORDERS (Supports Admin and Customer filtering)
exports.getOrders = async (req, res) => {
  try {
    const roleQuery = await db.User.findOne({ where: { id: req.body.user.id, deleted_at: null } });
    if (!roleQuery) return res.status(404).json({ error: "User not found" });

    let whereClause = "";
    let replacements = {};
    if (roleQuery.role !== 'admin') {
      whereClause = "WHERE oi.user_id = :userId";
      replacements = { userId: req.body.user.id };
    }

    const query = `
      SELECT 
        oi.id,
        DATE_FORMAT(oi.date_placed, '%Y-%m-%d') as date,
        os.status_name as status,
        COALESCE(SUM(ol.quantity * ol.sell_price), 0) as total,
        GROUP_CONCAT(i.name SEPARATOR '||') as items_list,
        DATE_FORMAT(oi.date_shipped, '%Y-%m-%d') as date_shipped
      FROM orderinfo oi
      LEFT JOIN orderline ol ON oi.id = ol.orderinfo_id
      LEFT JOIN item i ON ol.item_id = i.id
      LEFT JOIN order_statuses os ON oi.status_id = os.id
      ${whereClause}
      GROUP BY oi.id
      ORDER BY oi.date_placed DESC;
    `;

    const orders = await db.sequelize.query(query, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT
    });

    const formatted = orders.map(o => ({
      id: 'TN-' + String(o.id).padStart(4, '0'),
      raw_id: o.id,
      date: o.date,
      status: o.status,
      total: parseFloat(o.total || 0),
      items: o.items_list ? o.items_list.split('||') : [],
      date_shipped: o.date_shipped
    }));

    res.status(200).json(formatted);
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// 2. PLACE AN ORDER
exports.placeOrder = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { cart, payment_method, address_id } = req.body;
    if (!cart || !cart.length) {
      await transaction.rollback();
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Fetch dynamic shipping fee setting
    const [settings] = await db.sequelize.query(
      "SELECT default_shipping_fee FROM settings LIMIT 1",
      { type: db.Sequelize.QueryTypes.SELECT, transaction }
    );
    const shippingFee = settings ? parseFloat(settings.default_shipping_fee) : 100.00;

    let address = null;
    if (address_id) {
      const [selectedAddress] = await db.sequelize.query(
        "SELECT id, street, city, province, zip_code FROM customer_addresses WHERE id = :addressId AND user_id = :userId AND deleted_at IS NULL LIMIT 1",
        {
          replacements: { addressId: address_id, userId: req.body.user.id },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      address = selectedAddress;
    }

    if (!address) {
      // Get user's shipping address (default first, or fallback to most recent)
      const [shippingAddress] = await db.sequelize.query(
        "SELECT id, street, city, province, zip_code FROM customer_addresses WHERE user_id = :userId AND is_default = 1 AND deleted_at IS NULL LIMIT 1",
        {
          replacements: { userId: req.body.user.id },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      address = shippingAddress;
    }

    if (!address) {
      const [fallbackAddress] = await db.sequelize.query(
        "SELECT id, street, city, province, zip_code FROM customer_addresses WHERE user_id = :userId AND deleted_at IS NULL ORDER BY id DESC LIMIT 1",
        {
          replacements: { userId: req.body.user.id },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      address = fallbackAddress;
    }

    if (!address) {
      await transaction.rollback();
      return res.status(400).json({ error: "Please add a shipping address in your profile before placing an order." });
    }

    // Insert into orderinfo
    const [orderId] = await db.sequelize.query(
      "INSERT INTO orderinfo (user_id, address_id, shipping_street, shipping_city, shipping_province, shipping_zip, shipping_fee, date_placed) VALUES (:userId, :addressId, :street, :city, :province, :zip, :shippingFee, CURRENT_TIMESTAMP)",
      {
        replacements: {
          userId: req.body.user.id,
          addressId: address.id,
          street: address.street,
          city: address.city,
          province: address.province,
          zip: address.zip_code,
          shippingFee: shippingFee
        },
        type: db.Sequelize.QueryTypes.INSERT,
        transaction
      }
    );

    // Insert order lines and decrement stock
    for (const item of cart) {
      // Validate stock levels
      const [itemInDb] = await db.sequelize.query(
        "SELECT id, name, quantity, sell_price FROM item WHERE id = :itemId FOR UPDATE",
        {
          replacements: { itemId: item.item_id },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction
        }
      );

      if (!itemInDb) {
        const err = new Error(`Item with ID ${item.item_id} not found.`);
        err.statusCode = 404;
        throw err;
      }

      if (itemInDb.quantity < item.quantity) {
        const err = new Error(`Insufficient stock for "${itemInDb.name}". Only ${itemInDb.quantity} left in stock.`);
        err.statusCode = 400;
        throw err;
      }

      const sellPrice = itemInDb.sell_price;

      // Look up latest cost price from restock logs
      const [latestRestock] = await db.sequelize.query(
        "SELECT cost_price FROM restock_logs WHERE item_id = :itemId ORDER BY created_at DESC LIMIT 1",
        {
          replacements: { itemId: item.item_id },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      const costPrice = latestRestock ? parseFloat(latestRestock.cost_price) : 0;

      await db.sequelize.query(
        "INSERT INTO orderline (orderinfo_id, item_id, cost_price, quantity, sell_price) VALUES (:orderinfoId, :itemId, :costPrice, :quantity, :sellPrice)",
        {
          replacements: {
            orderinfoId: orderId,
            itemId: item.item_id,
            costPrice: costPrice,
            quantity: item.quantity,
            sellPrice: sellPrice
          },
          type: db.Sequelize.QueryTypes.INSERT,
          transaction
        }
      );

      // Decrement stock quantity
      await db.sequelize.query(
        "UPDATE item SET quantity = quantity - :quantity WHERE id = :itemId",
        {
          replacements: {
            quantity: item.quantity,
            itemId: item.item_id
          },
          type: db.Sequelize.QueryTypes.UPDATE,
          transaction
        }
      );
    }

    // Calculate total and insert payment record
    let orderSubtotal = 0;
    for (const item of cart) {
      const [itemInDb] = await db.sequelize.query(
        "SELECT sell_price FROM item WHERE id = :itemId",
        {
          replacements: { itemId: item.item_id },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      const price = itemInDb ? itemInDb.sell_price : item.price;
      orderSubtotal += parseFloat(price) * parseInt(item.quantity);
    }
    const amountPaid = orderSubtotal + shippingFee; // subtotal + shipping fee

    let method = 'cod';
    if (payment_method && ['cod', 'gcash', 'card', 'bank_transfer'].includes(payment_method)) {
      method = payment_method;
    }

    const paymentStatus = method === 'cod' ? 'pending' : 'paid';
    const paidAt = method === 'cod' ? null : new Date();
    
    let transactionRef = null;
    if (method !== 'cod') {
      let prefix = '';
      if (method === 'gcash') prefix = 'GC';
      else if (method === 'card') prefix = 'CARD';
      else if (method === 'bank_transfer') prefix = 'BT';

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const date = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${date}`;
      transactionRef = `${prefix}-${dateStr}-${String(orderId).padStart(3, '0')}`;
    }

    await db.sequelize.query(
      "INSERT INTO payments (orderinfo_id, payment_method, amount_paid, payment_status, transaction_ref, paid_at) VALUES (:orderinfoId, :method, :amountPaid, :paymentStatus, :transactionRef, :paidAt)",
      {
        replacements: {
          orderinfoId: orderId,
          method,
          amountPaid: amountPaid,
          paymentStatus,
          transactionRef,
          paidAt
        },
        type: db.Sequelize.QueryTypes.INSERT,
        transaction
      }
    );

    await transaction.commit();

    // Send order confirmation receipt email
    const formattedOrderId = 'TN-' + String(orderId).padStart(4, '0');
    try {
      // Fetch store settings for dynamic store name, email, and phone
      const storeSettings = await db.Settings.findOne();
      const storeName = storeSettings ? storeSettings.store_name : 'Tunify';
      const storeEmail = storeSettings ? storeSettings.store_contact_email : '';
      const storePhone = storeSettings ? storeSettings.store_contact_phone : '';
      // Fetch customer info for the email
      const [userInfo] = await db.sequelize.query(
        `SELECT u.email, CONCAT(c.first_name, ' ', c.last_name) as customer_name, c.phone
         FROM users u JOIN customer c ON u.id = c.user_id WHERE u.id = :userId`,
        { replacements: { userId: req.body.user.id }, type: db.Sequelize.QueryTypes.SELECT }
      );
      // Fetch order line items with names
      const orderItems = await db.sequelize.query(
        `SELECT i.name, ol.quantity, ol.sell_price as price
         FROM orderline ol JOIN item i ON ol.item_id = i.id WHERE ol.orderinfo_id = :orderId`,
        { replacements: { orderId }, type: db.Sequelize.QueryTypes.SELECT }
      );
      const sub = orderSubtotal;
      const fee = storeSettings ? parseFloat(storeSettings.default_shipping_fee) : 100.00;
      const total = sub + fee;
      const paymentLabel = { cod: 'Cash on Delivery', gcash: 'GCash', card: 'Credit/Debit Card', bank_transfer: 'Bank Transfer' }[method] || method;
      const html = buildReceiptHtml({
        orderId: formattedOrderId,
        customerName: userInfo ? userInfo.customer_name : '',
        customerEmail: userInfo ? userInfo.email : '',
        customerPhone: userInfo ? userInfo.phone : '',
        shippingStreet: address.street,
        shippingCity: address.city,
        shippingProvince: address.province,
        shippingZip: address.zip_code,
        datePlaced: new Date().toISOString(),
        dateShipped: null,
        statusName: 'Pending',
        paymentMethod: method,
        paymentStatus,
        transactionRef,
        items: orderItems,
        subtotal: sub,
        shippingFee: fee,
        grandTotal: total,
        headerTitle: 'Order Confirmed!',
        headerSubtitle: `Thank you for your purchase, ${userInfo ? userInfo.customer_name.split(' ')[0] : 'Customer'}!`,
        storeName,
        storeEmail,
        storePhone
      });
      const pdfBuffer = await generateReceiptPdf({
        orderId: formattedOrderId,
        customerName: userInfo ? userInfo.customer_name : 'Customer',
        customerEmail: userInfo ? userInfo.email : '',
        customerPhone: userInfo ? userInfo.phone : '',
        shippingStreet: address.street,
        shippingCity: address.city,
        shippingProvince: address.province,
        shippingZip: address.zip_code,
        datePlaced: new Date().toISOString(),
        dateShipped: null,
        statusName: 'Pending',
        paymentMethod: method,
        paymentStatus,
        transactionRef,
        items: orderItems,
        subtotal: sub,
        shippingFee: fee,
        grandTotal: total,
        storeName
      });

      await sendEmail({
        email: userInfo.email,
        subject: `${storeName} Order ${formattedOrderId} — Order Confirmation`,
        html,
        attachments: [
          {
            filename: `${storeName}-Receipt-${formattedOrderId}.pdf`,
            content: pdfBuffer
          }
        ]
      });
    } catch (emailErr) {
      console.log('Order confirmation email error:', emailErr);
    }

    res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      orderId: 'TN-' + String(orderId).padStart(4, '0')
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Failed to place order:", error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || "Failed to place order" });
  }
};

// 3. UPDATE ORDER STATUS
exports.updateOrderStatus = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    const { status } = req.body; // status name (string) or status ID (number)

    if (!id || status === undefined) {
      await transaction.rollback();
      return res.status(400).json({ error: "Order ID and status are required" });
    }

    const rawId = Number(id.replace('TN-', '')) || id;

    // Resolve status name and ID
    let statusId = null;
    let statusName = null;

    if (typeof status === 'number' || !isNaN(status)) {
      const [resolved] = await db.sequelize.query(
        "SELECT id, status_name FROM order_statuses WHERE id = :id",
        { replacements: { id: Number(status) }, type: db.Sequelize.QueryTypes.SELECT, transaction }
      );
      if (resolved) {
        statusId = resolved.id;
        statusName = resolved.status_name;
      }
    } else {
      const [resolved] = await db.sequelize.query(
        "SELECT id, status_name FROM order_statuses WHERE LOWER(status_name) = LOWER(:name)",
        { replacements: { name: String(status).trim() }, type: db.Sequelize.QueryTypes.SELECT, transaction }
      );
      if (resolved) {
        statusId = resolved.id;
        statusName = resolved.status_name;
      }
    }

    if (!statusId) {
      await transaction.rollback();
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }

    // Get current order state and customer email
    const [oldOrder] = await db.sequelize.query(
      `SELECT oi.status_id, oi.user_id, u.email as customer_email
       FROM orderinfo oi
       JOIN users u ON oi.user_id = u.id
       WHERE oi.id = :id`,
      { replacements: { id: rawId }, type: db.Sequelize.QueryTypes.SELECT, transaction }
    );

    if (!oldOrder) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    // Security check: Only admin or the order owner can update/cancel the order
    if (req.body.user.role !== 'admin' && oldOrder.user_id !== req.body.user.id) {
      await transaction.rollback();
      return res.status(403).json({ error: "Access denied. You can only update your own orders." });
    }

    const oldStatusId = oldOrder.status_id;

    // 1. Stock handling if order is Cancelled
    if (statusId === 5 && oldStatusId !== 5) {
      // Transitioning TO Cancelled: Restore stock
      const lines = await db.sequelize.query(
        "SELECT item_id, quantity FROM orderline WHERE orderinfo_id = :id",
        { replacements: { id: rawId }, type: db.Sequelize.QueryTypes.SELECT, transaction }
      );
      for (const line of lines) {
        await db.sequelize.query(
          "UPDATE item SET quantity = quantity + :qty WHERE id = :itemId",
          { replacements: { qty: line.quantity, itemId: line.item_id }, type: db.Sequelize.QueryTypes.UPDATE, transaction }
        );
      }
    } else if (statusId !== 5 && oldStatusId === 5) {
      // Transitioning FROM Cancelled: Decrement stock
      const lines = await db.sequelize.query(
        "SELECT item_id, quantity FROM orderline WHERE orderinfo_id = :id",
        { replacements: { id: rawId }, type: db.Sequelize.QueryTypes.SELECT, transaction }
      );
      for (const line of lines) {
        await db.sequelize.query(
          "UPDATE item SET quantity = GREATEST(quantity - :qty, 0) WHERE id = :itemId",
          { replacements: { qty: line.quantity, itemId: line.item_id }, type: db.Sequelize.QueryTypes.UPDATE, transaction }
        );
      }
    }

    // 2. COD payment handling if status is Delivered
    if (statusName === 'Delivered') {
      await db.sequelize.query(
        "UPDATE payments SET payment_status = 'paid', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP) WHERE orderinfo_id = :orderId AND payment_method = 'cod' AND payment_status = 'pending'",
        { replacements: { orderId: rawId }, type: db.Sequelize.QueryTypes.UPDATE, transaction }
      );
    }

    // Auto-mark non-COD payments as paid when processed/shipped/delivered
    if (statusName === 'Processing' || statusName === 'Shipped' || statusName === 'Delivered') {
      const [payment] = await db.sequelize.query(
        "SELECT payment_method, transaction_ref FROM payments WHERE orderinfo_id = :orderId",
        { replacements: { orderId: rawId }, type: db.Sequelize.QueryTypes.SELECT, transaction }
      );
      if (payment && payment.payment_method !== 'cod' && !payment.transaction_ref) {
        let prefix = '';
        if (payment.payment_method === 'gcash') prefix = 'GC';
        else if (payment.payment_method === 'card') prefix = 'CARD';
        else if (payment.payment_method === 'bank_transfer') prefix = 'BT';

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${date}`;
        const ref = `${prefix}-${dateStr}-${String(rawId).padStart(3, '0')}`;

        await db.sequelize.query(
          "UPDATE payments SET payment_status = 'paid', transaction_ref = :ref, paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP) WHERE orderinfo_id = :orderId AND payment_status = 'pending'",
          { replacements: { orderId: rawId, ref }, type: db.Sequelize.QueryTypes.UPDATE, transaction }
        );
      } else {
        await db.sequelize.query(
          "UPDATE payments SET payment_status = 'paid', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP) WHERE orderinfo_id = :orderId AND payment_method != 'cod' AND payment_status = 'pending'",
          { replacements: { orderId: rawId }, type: db.Sequelize.QueryTypes.UPDATE, transaction }
        );
      }
    }

    // Determine date_shipped update
    let dateShippedQuery = "";
    if (statusName === 'Shipped' || statusName === 'Delivered') {
      dateShippedQuery = "date_shipped = COALESCE(date_shipped, CURRENT_TIMESTAMP)";
    } else {
      dateShippedQuery = "date_shipped = NULL";
    }

    // Update order status
    await db.sequelize.query(
      `UPDATE orderinfo SET status_id = :statusId, ${dateShippedQuery} WHERE id = :id`,
      {
        replacements: { statusId, id: rawId },
        type: db.Sequelize.QueryTypes.UPDATE,
        transaction
      }
    );

    await transaction.commit();

    // Lab 7: Send rich receipt email on status update
    const orderId = 'TN-' + String(rawId).padStart(4, '0');
    try {
      // Fetch store settings for dynamic store name, email, and phone
      const storeSettings = await db.Settings.findOne();
      const storeName = storeSettings ? storeSettings.store_name : 'Tunify';
      const storeEmail = storeSettings ? storeSettings.store_contact_email : '';
      const storePhone = storeSettings ? storeSettings.store_contact_phone : '';
      // Fetch full order details for the receipt
      const [orderDetails] = await db.sequelize.query(
        `SELECT oi.shipping_street, oi.shipping_city, oi.shipping_province, oi.shipping_zip,
                oi.shipping_fee, oi.date_placed, oi.date_shipped,
                CONCAT(c.first_name, ' ', c.last_name) as customer_name, c.phone as customer_phone,
                p.payment_method, p.payment_status, p.transaction_ref
         FROM orderinfo oi
         JOIN customer c ON oi.user_id = c.user_id
         LEFT JOIN payments p ON oi.id = p.orderinfo_id
         WHERE oi.id = :id`,
        { replacements: { id: rawId }, type: db.Sequelize.QueryTypes.SELECT }
      );
      const orderItems = await db.sequelize.query(
        `SELECT i.name, ol.quantity, ol.sell_price as price
         FROM orderline ol JOIN item i ON ol.item_id = i.id WHERE ol.orderinfo_id = :id`,
        { replacements: { id: rawId }, type: db.Sequelize.QueryTypes.SELECT }
      );
      const sub = orderItems.reduce((s, it) => s + parseFloat(it.price) * parseInt(it.quantity), 0);
      const fee = parseFloat(orderDetails ? orderDetails.shipping_fee : 100);
      const total = sub + fee;
      const html = buildReceiptHtml({
        orderId,
        customerName: orderDetails ? orderDetails.customer_name : '',
        customerEmail: oldOrder.customer_email,
        customerPhone: orderDetails ? orderDetails.customer_phone : '',
        shippingStreet: orderDetails ? orderDetails.shipping_street : '',
        shippingCity: orderDetails ? orderDetails.shipping_city : '',
        shippingProvince: orderDetails ? orderDetails.shipping_province : '',
        shippingZip: orderDetails ? orderDetails.shipping_zip : '',
        datePlaced: orderDetails ? orderDetails.date_placed : null,
        dateShipped: orderDetails ? orderDetails.date_shipped : null,
        statusName,
        paymentMethod: orderDetails ? orderDetails.payment_method : '',
        paymentStatus: orderDetails ? orderDetails.payment_status : '',
        transactionRef: orderDetails ? orderDetails.transaction_ref : null,
        items: orderItems,
        subtotal: sub,
        shippingFee: fee,
        grandTotal: total,
        headerTitle: `Order Status Updated`,
        headerSubtitle: `Your order is now: ${statusName}`,
        storeName,
        storeEmail,
        storePhone
      });
      const pdfBuffer = await generateReceiptPdf({
        orderId,
        customerName: orderDetails ? orderDetails.customer_name : '',
        customerEmail: oldOrder.customer_email,
        customerPhone: orderDetails ? orderDetails.customer_phone : '',
        shippingStreet: orderDetails ? orderDetails.shipping_street : '',
        shippingCity: orderDetails ? orderDetails.shipping_city : '',
        shippingProvince: orderDetails ? orderDetails.shipping_province : '',
        shippingZip: orderDetails ? orderDetails.shipping_zip : '',
        datePlaced: orderDetails ? orderDetails.date_placed : null,
        dateShipped: orderDetails ? orderDetails.date_shipped : null,
        statusName,
        paymentMethod: orderDetails ? orderDetails.payment_method : '',
        paymentStatus: orderDetails ? orderDetails.payment_status : '',
        transactionRef: orderDetails ? orderDetails.transaction_ref : null,
        items: orderItems,
        subtotal: sub,
        shippingFee: fee,
        grandTotal: total,
        storeName
      });

      await sendEmail({
        email: oldOrder.customer_email,
        subject: `${storeName} Order ${orderId} — Status Updated to ${statusName}`,
        html,
        attachments: [
          {
            filename: `${storeName}-Receipt-${orderId}.pdf`,
            content: pdfBuffer
          }
        ]
      });
    } catch (emailErr) {
      console.log('Status update email error:', emailErr);
    }

    res.status(200).json({ success: true, message: `Order status updated to ${statusName}!` });
  } catch (error) {
    await transaction.rollback();
    console.error("Failed to update order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
};

// 4. GET ORDER DETAILS (Invoice/Receipt details)
exports.getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const rawId = Number(id.replace('TN-', '')) || id;

    // Get order summary & customer details
    const [order] = await db.sequelize.query(
      `SELECT 
         oi.id,
         DATE_FORMAT(oi.date_placed, '%Y-%m-%d %H:%i:%s') as date_placed,
         DATE_FORMAT(oi.date_shipped, '%Y-%m-%d %H:%i:%s') as date_shipped,
         os.status_name as status,
         oi.status_id,
         oi.shipping_street,
         oi.shipping_city,
         oi.shipping_province,
         oi.shipping_zip,
         oi.shipping_fee,
         u.email as customer_email,
         CONCAT(c.first_name, ' ', c.last_name) as customer_name,
         c.phone as customer_phone,
         p.payment_method,
         p.payment_status,
         p.transaction_ref
       FROM orderinfo oi
       JOIN users u ON oi.user_id = u.id
       JOIN customer c ON u.id = c.user_id
       LEFT JOIN order_statuses os ON oi.status_id = os.id
       LEFT JOIN payments p ON oi.id = p.orderinfo_id
       WHERE oi.id = :id`,
      {
        replacements: { id: rawId },
        type: db.Sequelize.QueryTypes.SELECT
      }
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Get order items (lines)
    const items = await db.sequelize.query(
      `SELECT 
         ol.item_id,
         ol.quantity,
         ol.sell_price as price,
         i.name as name
       FROM orderline ol
       JOIN item i ON ol.item_id = i.id
       WHERE ol.orderinfo_id = :id`,
      {
        replacements: { id: rawId },
        type: db.Sequelize.QueryTypes.SELECT
      }
    );

    res.status(200).json({
      ...order,
      items
    });
  } catch (error) {
    console.error("Failed to fetch order details:", error);
    res.status(500).json({ error: "Failed to fetch order details" });
  }
};
