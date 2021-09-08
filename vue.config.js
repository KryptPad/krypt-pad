module.exports = {
    // Where to output scripts
    outputDir: "dist",
    publicPath: "",
    // Don't add hash to file names
    filenameHashing: false,
    // Don't extract css to it's own file
    css: { extract: false },
    pages: {
        "index": "app/pages/index.js"
    },
    runtimeCompiler: true
}