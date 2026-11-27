export default {
  async fetch(request) {
    return new Response("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Hello World</title></head><body>Hello World</body></html>", {
      headers: { "Content-Type": "text/html; charset=UTF-8" }
    });
  }
};
