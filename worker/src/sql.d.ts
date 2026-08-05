// .sql files are bundled as text via the "Text" rule in wrangler.jsonc.
declare module "*.sql" {
  const content: string;
  export default content;
}
