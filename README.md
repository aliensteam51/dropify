Dropify
===

Combine HTML and the assets used in it into one file. Asset files are included as base64 javascript strings in the HTML file.

Below you will see an example of an input HTML file Dropify can work with:

	<!DOCTYPE html>
	<html lang="en">
	<head><title>Example</title></head>
	<body>
	    <!--Dropify:sounds-->
	    <h1>42</h1>
	    <!--Dropify:images#-->
	</body>
	</html>
	
After Dropify the output HTML file will look something like this:

	<!DOCTYPE html>
	<html lang="en">
	<head><title>Example</title></head>
	<body>
	    <script type='text/javascript'> 
	        var sounds = {
	            can : 'aGVsbG8gd29ybGQh', 
	            crash : 'aGVsbG8gd29ybGQh', 
	            background : {
	                music : 'aGVsbG8gd29ybGQh'
	            }
	        }; 
	    </script>
	    <h1>42</h1>
	    <script type='text/javascript'> 
	        var images = {
	            appel : 'data:image/jpeg;base64,aGVsbG8gd29ybGQh', 
	            appel2 : 'data:image/jpeg;base64,aGVsbG8gd29ybGQh', 
	            appels : {
	                appel3 : 'data:image/jpeg;base64,aGVsbG8gd29ybGQh'
	            }
	        }; 
	    </script>
	</body>
	</html>	

In the example above the given asset folder would look like this:

	- assets
		- sounds
			- can.mp3
			- crash.mp3
			- background
				- music.mp3
		- images
			- appel.jpg
			- appel2.jpg
			- appels
				- appel3.jpg

So Dropify will try to match the tags in the input HTML with subfolders in the root assets folder given. 

It will then convert the matched subfolders to a <script></script> string containing a single javascript dictionary variable named the same as the subfolder. The dictionary will contain keys corresponding to file names and subfolders and the values are the files represented as base64 strings.

If the tag in the input HTML contains a pound sign, like:

	<!--Dropify:images#-->

Dropify will add a data URI part before the base64 string, the mime type for the data URI is subtracted from the file extension, the following file extensions are supported by default on the moment:

	supportedExtensions : {
        ".png" : "image/png",
        ".jpg" : "image/jpeg",
        ".wav" : "audio/wav",
        ".mp3" : "audio/mpeg3"
    }
    
You can add other extensions before using Dropify:

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

   