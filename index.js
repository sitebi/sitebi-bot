const SiTebi = require("./Bot");
const text = `bot running at ${Date()}`;

function main() {
  try {
    console.log(text);
    new SiTebi();
  } catch (error) {
    console.log(text);
    new SiTebi();
  }
}

main();
