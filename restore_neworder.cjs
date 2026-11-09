const fs = require('fs');

const transcript = fs.readFileSync('/home/hamza/.gemini/antigravity/brain/87926058-3993-4837-bdb1-488a11709413/.system_generated/logs/transcript_full.jsonl', 'utf8');
const lines = transcript.split('\n');

let lastCatIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('cat src/screens/NewOrderScreen.jsx') || lines[i].includes('cat "src/screens/NewOrderScreen.jsx"')) {
    lastCatIndex = i;
  }
}

if (lastCatIndex !== -1) {
  // Find the next GENERIC step which contains the output
  for (let i = lastCatIndex + 1; i < lines.length; i++) {
    if (lines[i].includes('"type":"GENERIC"')) {
      const step = JSON.parse(lines[i]);
      if (step.content.includes('The command exited with code 0')) {
        let output = step.content;
        // The output starts after "Output:\n"
        const outputMarker = 'Output:\n';
        const markerIndex = output.indexOf(outputMarker);
        if (markerIndex !== -1) {
          let fileContent = output.substring(markerIndex + outputMarker.length);
          fs.writeFileSync('src/screens/NewOrderScreen.jsx', fileContent);
          console.log('✅ Restored NewOrderScreen.jsx to size ' + fileContent.length);
        }
        break;
      }
    }
  }
} else {
  console.log('Not found');
}
