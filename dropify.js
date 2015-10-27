var fs = require('fs')
var path = require('path')
var async = require('async')

var __dropify = {
    directoryList : function(dir, callback) {
        var self = this
        var directories = []
        var files = []

        fs.readdir(dir, function(err, list) {
            if (err) {
                callback(err)
                return
            }

            async.eachSeries(list, function(file, callback) {
                var fullPath = path.join(dir, file)

                fs.stat(fullPath, function(err, stat) {
                    var isHiddenItem = file.substring(0, 1) === "."

                    if (!err && !isHiddenItem) {
                        if (stat.isDirectory()) {
                            directories.push({
                                path : fullPath,
                                name : path.basename(file)
                            })
                        } else {
                            var extension = path.extname(file)
                            files.push({
                                path : fullPath,
                                name : path.basename(file, extension)
                            })
                        }
                    }

                    callback(null)
                })
            }, function() {
                callback(null, {directories : directories, files : files})
            })
        })
    },

    fileToBase64String : function(file, encodeAsDataURI, callback) {
        var self = this

        fs.readFile(file, function(err, data) {
            if (err) {
                callback(err)
            } else {
                var base64String = new Buffer(data).toString('base64')

                if (encodeAsDataURI) {
                    var extension = path.extname(file)
                    var mimeType = self.extensionToMimeType(extension)

                    if (mimeType) {
                        var dataURI = self.dataUriWithBase64StringAndMimeType(base64String, mimeType)
                        callback(null, dataURI)
                    } else {
                        var mimeErr = new Error("Unknown file extension " + extension)
                        callback(mimeErr)
                    }
                } else {
                    callback(null, base64String)
                }
            }
        })
    },

    extensionToMimeType: function(extension) {
        var mimeType;

        switch (extension) {
            case ".png":
                mimeType = "image/png"
                break
            case ".jpg":
                mimeType = "image/jpeg"
                break
            case ".wav":
                mimeType = "audio/wav"
                break
            case ".mp3":
                mimeType = "audio/mpeg3"
                break
        }

        return mimeType
    },

    dataUriWithBase64StringAndMimeType: function(base64String, mimeType) {
        return "data:" + mimeType + ";base64," + base64String
    },

    directoryToBase64Map : function(dir, encodeAsDataURI, callback) {
        var map = {}
        var self = this

        this.directoryList(dir, function(err, result) {
            var files = result.files
            var directories = result.directories

            async.eachSeries(files, function(file, callback) {
                self.fileToBase64String(file.path, encodeAsDataURI, function(err, base64String) {
                    if (base64String) {
                        map[file.name] = base64String
                    }
                    callback(null)
                })
            }, function() {
                async.eachSeries(directories, function(directory, callback) {
                    self.directoryToBase64Map(directory.path, encodeAsDataURI, function(err, submap) {
                        if (submap) {
                            map[directory.name] = submap
                        }
                        callback(null)
                    })
                }, function() {
                    callback(null, map)
                })
            })
        })
    },

    dictionaryToJavascriptString : function(dict) {
        var str = "{"
        var first = true
        var self = this

        Object.keys(dict).forEach(function(key) {
            if (first) {
                first = false;
            } else {
                str += ", "
            }

            var obj = dict[key]

            if (typeof obj === 'string') {
                obj = "'" + dict[key] + "'"
            } else {
                obj = self.dictionaryToJavascriptString(obj)
            }

            str += key + " : " + obj
        })

        str += "}"

        return str
    },

    getDropifyTagsForSource : function(source) {
        var regex = /(<!--Dropify:([a-zA-Z_$][0-9a-zA-Z_$]*#?)-->)/g
        var tags = {}

        while (match = regex.exec(source)) {
            var tag = match[2]
            var encodeAsDataURI = (tag.slice(-1) === "#")

            if (encodeAsDataURI) {
                tag = tag.slice(0, -1)
            }

            tags[tag] = {encodeAsDataURI : encodeAsDataURI};
        }

        return tags
    },

    getDropifyTagsForRoot : function(root, source) {
        var tags = this.getDropifyTagsForSource(source)

        Object.keys(tags).forEach(function(tag) {
            var folder = path.join(root, tag)
            var info = tags[tag]

            info.path = folder
        })

        return tags
    },

    replaceDropifyTagWithString : function(source, tag, replacementString) {
        var regex = new RegExp("<!--Dropify:" + tag + "-->")

        regex.global = true

        return source.replace(regex, replacementString)
    },

    directoryToJavascriptTag : function(dir, varName, encodeAsDataURI, callback) {
        var self = this

        self.directoryToBase64Map(dir, encodeAsDataURI, function(err, map) {
            if (err) {
                callback(err)
            } else {
                var js = "<script type='text/javascript'> var " +
                         varName +
                        " = " +
                        self.dictionaryToJavascriptString(map) +
                        "; </script>"
                callback(null, js)
            }
        })
    },


}

module.exports = {
    dropify : function(assetsPath, htmlInputPath, htmlOutputPath, callback) {
        fs.readFile(htmlInputPath, 'utf-8', function(err, htmlData) {
            if (err) {
                callback(err)
            } else {
                var tags = __dropify.getDropifyTagsForRoot(assetsPath, htmlData)
                var htmlDataContainer = {html : htmlData}

                async.eachSeries(Object.keys(tags), function(tag, callback) {
                    var tagInfo = tags[tag]
                    var encodeAsDataURI = tagInfo.encodeAsDataURI
                    __dropify.directoryToJavascriptTag(tagInfo.path, tag, encodeAsDataURI, function(err, jsTagStr) {
                        if (err) {
                            callback(err)
                        } else {
                            var fullTag = encodeAsDataURI? tag + '#' : tag
                            htmlDataContainer.html = __dropify.replaceDropifyTagWithString(htmlDataContainer.html, fullTag, jsTagStr)
                            callback(null)
                        }
                    })
                }, function() {
                    fs.writeFile(htmlOutputPath, htmlDataContainer.html, function(err) {
                        callback(err)
                    })
                })
            }
        })
    }
}
