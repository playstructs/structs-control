import path from "node:path";
import { fileURLToPath } from "node:url";
import CopyWebpackPlugin from "copy-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import NodePolyfillPlugin from "node-polyfill-webpack-plugin";
import webpack from "webpack";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Webpack config for structs-control.
 *
 * Mirrors the structs-webapp config (top-level await, node polyfills, ts-loader)
 * and adds: SCSS pipeline, HtmlWebpackPlugin, dev-server with historyApiFallback,
 * Host-header proxy for /api, and route-level code splitting.
 *
 * Env (build-time):
 *   STRUCTS_GUILD_API_URL    e.g. https://guild.example.com  (baked-in fallback,
 *                            production only — in dev the SPA always calls
 *                            same-origin /api so the dev proxy can forward it)
 *   STRUCTS_DEV_PROXY_TARGET dev-only: where webpack-dev-server forwards /api.
 *                            Defaults to http://localhost:8080 (Docker Symfony API).
 *   STRUCTS_GUILD_API_HOST   Host header to send through the dev proxy (DNS workaround)
 *   STRUCTS_DEV_GALLERY      "1" to mount /dev/components and /dev/tests routes
 *   CHOKIDAR_USEPOLLING      "true" for file watching inside Docker (macOS bind mounts)
 *
 * Docker (STRUCTS_CONTROL_MODE=dev|prod): see Dockerfile + docker/entrypoint.sh
 *
 * Runtime config preferred: public/config.js sets window.STRUCTS_CONFIG and is
 * served alongside the bundle so operators can redeploy the same static build
 * against any guild host.
 */
export default (_env, argv) => {
  const isProd = argv.mode === "production";
  // Bake a base URL into the bundle ONLY for production. In dev we force
  // same-origin /api so the webpack dev-server proxy handles cookies/CORS.
  const apiUrl = isProd ? process.env.STRUCTS_GUILD_API_URL || "" : "";
  const devProxyTarget = process.env.STRUCTS_DEV_PROXY_TARGET || process.env.STRUCTS_GUILD_API_URL || "http://localhost:8080";
  const apiHost = process.env.STRUCTS_GUILD_API_HOST || "";
  const devGallery = process.env.STRUCTS_DEV_GALLERY === "1";

  return {
    entry: {
      index: "./src/js/index.js",
    },
    watchOptions: {
      poll: process.env.CHOKIDAR_USEPOLLING === "true" ? 1000 : undefined,
    },
    output: {
      filename: isProd ? "js/[name].[contenthash:8].js" : "js/[name].js",
      chunkFilename: isProd ? "js/[name].[contenthash:8].chunk.js" : "js/[name].chunk.js",
      path: path.resolve(__dirname, "dist"),
      publicPath: "/",
      clean: true,
      sourceMapFilename: "[file].map",
    },
    devtool: isProd ? "source-map" : "eval-cheap-module-source-map",
    experiments: {
      topLevelAwait: true,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".mjs"],
      extensionAlias: {
        ".js": [".js", ".ts"],
        ".cjs": [".cjs", ".cts"],
        ".mjs": [".mjs", ".mts"],
      },
      alias: {
        "@": path.resolve(__dirname, "src/js"),
        "@styles": path.resolve(__dirname, "src/styles"),
      },
    },
    module: {
      rules: [
        {
          test: /\.([cm]?ts|tsx)$/,
          loader: "ts-loader",
          options: { transpileOnly: true },
        },
        {
          test: /\.scss$/,
          use: [
            isProd ? MiniCssExtractPlugin.loader : "style-loader",
            "css-loader",
            {
              loader: "sass-loader",
              options: {
                api: "modern-compiler",
                sassOptions: { quietDeps: true, silenceDeprecations: ["import", "legacy-js-api"] },
              },
            },
          ],
        },
        {
          test: /\.css$/,
          use: [isProd ? MiniCssExtractPlugin.loader : "style-loader", "css-loader"],
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg|woff2?|eot|ttf)$/,
          type: "asset/resource",
        },
      ],
    },
    plugins: [
      new NodePolyfillPlugin(),
      new HtmlWebpackPlugin({
        template: "./public/index.html",
        inject: "body",
        scriptLoading: "defer",
      }),
      new webpack.DefinePlugin({
        "process.env.STRUCTS_GUILD_API_URL": JSON.stringify(apiUrl),
        "process.env.STRUCTS_DEV_GALLERY": JSON.stringify(devGallery ? "1" : ""),
        "process.env.NODE_ENV": JSON.stringify(isProd ? "production" : "development"),
      }),
      ...(isProd
        ? [
            new MiniCssExtractPlugin({
              filename: "css/[name].[contenthash:8].css",
              chunkFilename: "css/[name].[contenthash:8].chunk.css",
            }),
          ]
        : []),
      new webpack.ProvidePlugin({
        Buffer: ["buffer", "Buffer"],
      }),
      ...(isProd
        ? [
            new CopyWebpackPlugin({
              patterns: [{ from: "public", to: ".", globOptions: { ignore: ["**/index.html"] } }],
            }),
          ]
        : []),
    ],
    optimization: {
      moduleIds: "deterministic",
      runtimeChunk: "single",
      splitChunks: {
        chunks: "all",
        cacheGroups: {
          cosmjs: {
            test: /[\\/]node_modules[\\/]@cosmjs[\\/]/,
            name: "cosmjs",
            priority: 30,
          },
          bootstrap: {
            test: /[\\/]node_modules[\\/]bootstrap[\\/]/,
            name: "bootstrap",
            priority: 20,
          },
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            priority: 10,
          },
        },
      },
    },
    devServer: {
      host: "0.0.0.0",
      allowedHosts: "all",
      static: { directory: path.resolve(__dirname, "public") },
      historyApiFallback: true,
      port: 8081,
      hot: true,
      client: { overlay: { errors: true, warnings: false } },
      proxy: !isProd
        ? [
            {
              context: ["/api"],
              target: devProxyTarget,
              changeOrigin: true,
              secure: false,
              headers: apiHost ? { Host: apiHost } : undefined,
              cookieDomainRewrite: "",
            },
          ]
        : [],
    },
    performance: {
      hints: isProd ? "warning" : false,
      maxAssetSize: 500_000,
      maxEntrypointSize: 600_000,
    },
  };
};
