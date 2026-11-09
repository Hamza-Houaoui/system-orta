fetch("https://api.telegram.org/bot").then(res => console.log(res.headers.get("access-control-allow-origin"))).catch(console.error);
