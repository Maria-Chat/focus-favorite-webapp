const url = "https://www.tiktok.com/@nokkung2/video/7685328572218608914?is_from_webapp=1&sender_device=pc";
fetch(`https://www.tikwm.com/api/?url=${url}`).then(r=>r.json()).then(console.log);
fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`).then(r=>r.json()).then(console.log);
