for example in simple complex
do
    rm "./examples/$example/gulpfile.js"
    docker run --rm -v $(realpath "./examples/$example/"):/data/package omouse/grunt2gulp.js
    echo "'./examples/$example/Gruntfile.js' => './examples/$example/gulpfile.js'"
done
