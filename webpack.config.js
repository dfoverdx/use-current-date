const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => ({
  mode: argv.mode || 'development',
  entry: './src/index.ts',
  output: {
    filename: argv.mode === 'production' ? 'index.min.js' : 'index.js',
    path: __dirname,
  },
  resolve: {
    extensions: ['.ts', '.js'],

  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    'react': 'react',
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
          compress: argv.mode === 'production',
          mangle: argv.mode === 'production',
          sourceMap: true,
        },
        extractComments: false,
      }),
    ],
  },
});
