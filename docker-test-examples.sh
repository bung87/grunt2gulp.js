for example in simple complex yeoman-generated-issue2 mosaico-issue20
do
    rm -f "./examples/$example/gulpfile.js"
    docker run --rm -v $(realpath "./examples/$example/"):/data/package omouse/grunt2gulp.js
    echo "'./examples/$example/Gruntfile.js' => './examples/$example/gulpfile.js'"
done
