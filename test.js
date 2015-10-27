dropify = require("./dropify")

var src = "/Users/almerlucke/Desktop/dropifyTagTest.html"
var dst = "/Users/almerlucke/Desktop/dropifyTagTestOutput.html"
var root = "/Users/almerlucke/Desktop/assets"

dropify.dropify(root, src, dst, function(err) {
    console.log('err', err)
})
