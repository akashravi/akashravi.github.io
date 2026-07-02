# frozen_string_literal: true

# Ruby 3.2 removed Object#tainted? / #taint / #untaint, but the Liquid version
# that Jekyll 4.x pins (liquid ~> 4.0) still calls them while rendering. Without
# this, `jekyll build`/`serve` dies with:
#
#   undefined method 'tainted?' for an instance of String (NoMethodError)
#
# Restore harmless no-ops so templates render on modern Ruby (3.2+, incl. 4.0).
# Guarded so it only applies where the methods are actually missing.
unless Object.new.respond_to?(:tainted?)
  class Object
    def tainted?
      false
    end

    def taint
      self
    end

    def untaint
      self
    end
  end
end
