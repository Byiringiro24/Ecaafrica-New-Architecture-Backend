/// <reference path="../types/swagger-jsdoc.d.ts" />
import type { Application } from "express";
import path from "path";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

export const setupSwagger = (app: Application) => {
  const apis = [
    path.join(__dirname, "../routes/**/*.ts"),
    path.join(__dirname, "../routes/**/*.js")
  ]; 

  const spec = swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Education Care Africa API",
        version: "1.0.0"
      },
      servers: [
        {
          url: "/api/v1"
        }
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        },
        responses: {
          Success: { description: "Success" },
          BadRequest: { description: "Bad request" },
          Unauthorized: { description: "Unauthorized" },
          Forbidden: { description: "Forbidden" },
          NotFound: { description: "Not found" },
          ServerError: { description: "Server error" }
        }
      }
    },
    apis
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec));
};
