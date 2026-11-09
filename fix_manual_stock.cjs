const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelDetailScreen.jsx', 'utf8');

const target = `{/* Manual Stock Control */}
              <div className="card"`;
const replacement = `{/* Manual Stock Control */}
              {!isWatcherDevice() && (
              <div className="card"`;

code = code.replace(target, replacement);

const target2 = `              </div>
            </div>

            </div>
          </div>`;
const replacement2 = `              </div>
            </div>
            )}

            </div>
          </div>`;

code = code.replace(target2, replacement2);
fs.writeFileSync('src/screens/ModelDetailScreen.jsx', code);
console.log('Fixed Manual Stock section');
