var fs = require('fs')
var path = require('path')
var async = require('async')

var __dropify = {
    supportedExtensions : {
        ".png" : "image/png",
        ".jpg" : "image/jpeg",
        ".wav" : "audio/wav",
        ".mp3" : "audio/mpeg3"
    },

    /**
     * Get an object containing a list of files and a list of dictionaries in the given directory
     * @param  {string}   dir      path to directory
     * @param  {Function} callback function(err, object)
     * @return {undefined}            no return value
     */
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
                            files.push({
                                path : fullPath,
                                name : path.basename(file)
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

    /**
     * Make a base64 string from file content
     * @param  {string}   file            path to the file
     * @param  {boolean}   encodeAsDataURI if true, add a data URI header to the string
     * @param  {Function} callback        function(err, base64 string)
     * @return {undefined}                   no return value
     */
    fileToBase64String : function(file, encodeAsDataURI, callback) {
        var self = this

        fs.readFile(file, function(err, data) {
            if (err) {
                callback(err)
            } else {
                var base64String = new Buffer(data).toString('base64')

                if (encodeAsDataURI) {
                    var extension = path.extname(file)
                    var mimeType = self.supportedExtensions[extension]

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

    /**
     * Prepend a data URI header to a base64 string
     * @param  {string} base64String a base64 encoded string
     * @param  {string} mimeType     a mime type to use in data URI header
     * @return {string}              data URI string
     */
    dataUriWithBase64StringAndMimeType: function(base64String, mimeType) {
        return "data:" + mimeType + ";base64," + base64String
    },

    /**
     * Create a dictionary recursively from files and subfolders.
     * The content of the files are encoded as base64 strings.
     * Subfolders are added as other dictionary objects
     * @param  {string}   dir             path to directory
     * @param  {boolean}   encodeAsDataURI if true, add a data URI header to the strings
     * @param  {Function} callback        function(err, dictionary)
     * @return {undefined}                   no return value
     */
    directoryToBase64Map : function(dir, encodeAsDataURI, callback) {
        var map = {}
        var self = this

        this.directoryList(dir, function(err, result) {
            var files = result.files
            var directories = result.directories

            async.eachSeries(files, function(file, callback) {
                self.fileToBase64String(file.path, encodeAsDataURI, function(err, base64String) {
                    if (base64String) {
                        map["" + file.name] = base64String
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

    /**
     * Convert a dictionary to a Javascript string
     * @param  {Object} dict the dictionary to convert
     * @return {string}      the string representation of the dictionary
     */
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

            str += "'" + key + "'" + " : " + obj
        })

        str += "}"

        return str
    },

    /**
     * Scan a HTML file for Dropify tags
     * @param  {string} source HTML as string
     * @return {Object}        a dictionary with tags found
     */
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

    /**
     * Get a dictionary of Dropify tags from a source HTML string and root path
     * @param  {string} root   path to root asset directory
     * @param  {string} source HTML string
     * @return {Object}        dictionary with tags
     */
    getDropifyTagsForRoot : function(root, source) {
        var tags = this.getDropifyTagsForSource(source)

        Object.keys(tags).forEach(function(tag) {
            var folder = path.join(root, tag)
            var info = tags[tag]

            info.path = folder
        })

        return tags
    },

    /**
     * Replace a Dropify tag with a script tag containing a base64 dictionary Object
     * @param  {string} source            HTML source string
     * @param  {string} tag               the tag to replace
     * @param  {string} replacementString the replacement string
     * @return {string}                   HTML with tags replaced
     */
    replaceDropifyTagWithString : function(source, tag, replacementString) {
        var regex = new RegExp("<!--Dropify:" + tag + "-->")

        regex.global = true

        return source.replace(regex, replacementString)
    },

    /**
     * Turn a directory into a javascript script tag
     * @param  {string}   dir             path to directory
     * @param  {string}   varName         variable name for the variable in the script tag
     * @param  {boolean}   encodeAsDataURI if true, add a data URI header to base64 strings
     * @param  {Function} callback        function(err, script string)
     * @return {undefined}                   no return value
     */
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
    }
}

module.exports = {
    /**
     * Return an Object containing all supported extensions
     * @return {Object} Supported extensions dictionary
     */
    supportedExtensions : function() {
        return __dropify.supportedExtensions
    },

    /**
     * The main operation, replace Dropify tags in HTML with javascript script tags containing
     * base64 representations of assets
     * @param  {string}   assetsPath     path to assets directory
     * @param  {string}   htmlInputPath  path to input HTML file
     * @param  {string}   htmlOutputPath path to output HTML file
     * @param  {Function} callback       function(err)
     * @return {undefined}                  no return value
     */
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
