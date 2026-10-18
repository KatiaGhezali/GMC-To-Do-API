const http = require("http");

const PORT = 3000;

let todos = [];
let nextId = 1;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");

  function getRequestBody() {
    return new Promise((resolve, reject) => {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk;

        if (body.length > 1_000_000) {
          reject(new Error("Request body too large."));
          req.destroy();
        }
      });

      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          reject(new Error("Invalid JSON."));
        }
      });

      req.on("error", reject);
    });
  }

  function sendResponse(statusCode, data) {
    res.writeHead(statusCode);
    res.end(JSON.stringify(data));
  }

  async function handleRequest() {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // GET /todos - Get all tasks
    if (req.method === "GET" && pathname === "/todos") {
      return sendResponse(200, todos);
    }

    // POST /todos - Create a task
    if (req.method === "POST" && pathname === "/todos") {
      let body;

      try {
        body = await getRequestBody();
      } catch (error) {
        return sendResponse(400, { error: error.message });
      }

      if (typeof body.title !== "string" || !body.title.trim()) {
        return sendResponse(400, {
          error: "Title is required and must be a non-empty string.",
        });
      }

      if (body.completed !== undefined && typeof body.completed !== "boolean") {
        return sendResponse(400, {
          error: "Completed must be a boolean.",
        });
      }

      const todo = {
        id: nextId++,
        title: body.title.trim(),
        completed: body.completed ?? false,
      };

      todos.push(todo);

      return sendResponse(201, todo);
    }

    // Match /todos/:id
    const match = pathname.match(/^\/todos\/([^/]+)$/);

    if (match) {
      const id = Number(match[1]);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return sendResponse(400, { error: "Invalid task ID." });
      }

      const index = todos.findIndex((todo) => todo.id === id);

      if (index === -1) {
        return sendResponse(404, { error: "Task not found." });
      }

      // GET /todos/:id - Get one task
      if (req.method === "GET") {
        return sendResponse(200, todos[index]);
      }

      // PUT /todos/:id - Update a task
      if (req.method === "PUT") {
        let body;

        try {
          body = await getRequestBody();
        } catch (error) {
          return sendResponse(400, { error: error.message });
        }

        if (
          body.title !== undefined &&
          (typeof body.title !== "string" || !body.title.trim())
        ) {
          return sendResponse(400, {
            error: "Title must be a non-empty string.",
          });
        }

        if (
          body.completed !== undefined &&
          typeof body.completed !== "boolean"
        ) {
          return sendResponse(400, {
            error: "Completed must be a boolean.",
          });
        }

        if (body.title === undefined && body.completed === undefined) {
          return sendResponse(400, {
            error: "Provide a title or completed status to update.",
          });
        }

        if (body.title !== undefined) {
          todos[index].title = body.title.trim();
        }

        if (body.completed !== undefined) {
          todos[index].completed = body.completed;
        }

        return sendResponse(200, todos[index]);
      }

      // DELETE /todos/:id - Delete a task
      if (req.method === "DELETE") {
        const [deletedTodo] = todos.splice(index, 1);

        res.writeHead(200);
        return res.end(
          JSON.stringify({
            message: "Task deleted successfully.",
            todo: deletedTodo,
          }),
        );
      }

      res.setHeader("Allow", "GET, PUT, DELETE");
      return sendResponse(405, { error: "Method not allowed." });
    }

    return sendResponse(404, { error: "Route not found." });
  }

  handleRequest().catch((error) => {
    console.error(error);

    if (!res.headersSent) {
      sendResponse(500, { error: "Internal server error." });
    } else if (!res.writableEnded) {
      res.end();
    }
  });
});

server.listen(PORT, () => {
  console.log(`To-Do API running at http://localhost:${PORT}`);
});
