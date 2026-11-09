const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

// Find where order is created
const target = `const order = {
        id: orderId,
        number,
        type: finalOrderType,
        status: finalOrderType,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        items,
        subtotal,
        discount: discountVal,
        totalPrice: total,
        paidAmount: finalOrderType === 'paid' ? paidVal : depositVal,
        depositAmount: finalOrderType === 'deposit' ? depositVal : 0,
        commission: commission > 0 ? commission : 0,
        note,
        createdAt: createdAt,
      };`;

const replacement = `const actualPaidAtCreation = finalOrderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
      const autoCommission = (finalOrderType === 'paid' && actualPaidAtCreation < total) ? (total - actualPaidAtCreation) : 0;
      
      const order = {
        id: orderId,
        number,
        type: finalOrderType,
        status: finalOrderType,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        items,
        subtotal,
        discount: discountVal,
        totalPrice: total,
        paidAmount: finalOrderType === 'paid' ? paidVal : depositVal,
        depositAmount: finalOrderType === 'deposit' ? depositVal : 0,
        commission: (commission > 0 ? parseFloat(commission) : 0) + autoCommission,
        note,
        createdAt: createdAt,
      };`;

code = code.replace(target, replacement);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed NOS order commission');
