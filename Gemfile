source "https://rubygems.org"

# Modern Jekyll — built locally and by the GitHub Actions deploy workflow.
# Local preview:  bundle install  &&  bundle exec jekyll serve
gem "jekyll", "~> 4.3"

# Ruby 3.4+ (incl. 4.0) dropped these from the default gems; declare what Jekyll
# and its dependencies still require so the build/serve can load them.
gem "base64"
gem "bigdecimal"
gem "csv"
gem "logger"

# jekyll serve's local web server needs webrick on Ruby 3+ (also no longer default).
gem "webrick"
