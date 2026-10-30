declare module "swagger-jsdoc" {
  type SwaggerSpec = Record<string, unknown>;
  type SwaggerDefinition = Record<string, unknown>;

  type SwaggerJSDocOptions = {
    definition?: SwaggerDefinition;
    apis?: string[] | string;
  } & Record<string, unknown>;

  function swaggerJSDoc(options: SwaggerJSDocOptions): SwaggerSpec;
  export default swaggerJSDoc;
}
