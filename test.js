dropify = require("./dropify")

var src = "/Users/almerlucke/Desktop/dropifyTagTest.html"
var dst = "/Users/almerlucke/Desktop/dropifyTagTestOutput.html"
var root = "/Users/almerlucke/Desktop/assets"

var supportedExtensions = dropify.supportedExtensions()

supportedExtensions[".png"] = "image/png"
supportedExtensions[".jpg"] = "image/jpeg"
supportedExtensions[".wav"] = "audio/wav"
supportedExtensions[".mp3"] = "audio/mpeg3"

dropify.dropify(root, src, dst, function(err) {
    console.log('err', err)
})
