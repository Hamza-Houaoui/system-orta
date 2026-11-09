const fs = require('fs');
let code = fs.readFileSync('src/screens/TelegramScreen.jsx', 'utf8');

code = code.replace(
  `  const stopQueue = () => {
    runnerRef.current = false;
    setIsRunning(false);
  };`,
  `  const stopQueue = () => {
    runnerRef.current = false;
    window._stopTelegramQueue = true;
    setIsRunning(false);
  };`
);

fs.writeFileSync('src/screens/TelegramScreen.jsx', code);
console.log('Fixed stopQueue');
