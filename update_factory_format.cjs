const fs = require('fs');
const file = 'src/toolbox/telegramFormatter.js';
let code = fs.readFileSync(file, 'utf8');

// Replace the dashboard section formatting
const oldDashboard = `    msg += \`📊 <b>FACTORY DASHBOARD</b>\\n\`;
    msg += \`📦 Models: \${fin.modelCount || 0}\\n\`;
    msg += \`💵 Stock Value: $\${newStock.toFixed(2)}\\n\`;
    msg += \`🔴 Total Debt: $\${newTotal.toFixed(2)}\\n\`;
    msg += \`⚖️ Net Balance: $\${(newTotal - newStock).toFixed(2)}\\n\`;
    msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  }
  
  msg += \`🐝 System Orta\`;
  return msg;
};`;

const newDashboard = `    msg += \`📊 <b>FACTORY DASHBOARD</b>\\n\`;
    msg += \`📦 Models: \${fin.modelCount || 0}\\n\`;
    msg += \`💵 Stock Value: $\${newStock.toFixed(2)}\\n\`;
    msg += \`⚖️ Net Balance: $\${(newTotal - newStock).toFixed(2)}\\n\`;
    msg += \`🔴 Total Debt: $\${newTotal.toFixed(2)}\\n\`;
  }
  
  return msg.trim();
};`;

// Replace extra blank line for items
const oldItemsLine = `    });
    msg += \`\\n\`;
  }`;

const newItemsLine = `    });
  }`;

if (code.includes(oldDashboard)) {
  code = code.replace(oldDashboard, newDashboard);
  code = code.replace(oldItemsLine, newItemsLine);
  
  // also replace extra newline after note/receiver
  code = code.replace(`    if (form?.note) msg += \`📝 Note: \${form.note}\\n\`;\n  }\n  msg += \`\\n\`;`, `    if (form?.note) msg += \`📝 Note: \${form.note}\\n\`;\n  }`);
  
  fs.writeFileSync(file, code);
  console.log('✅ Updated Factory formatting');
} else {
  console.log('⚠️ Pattern not found');
}
