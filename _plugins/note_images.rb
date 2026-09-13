# frozen_string_literal: true

require 'fileutils'
require 'shellwords'

module Jekyll
  module NoteImages
    NOTE_IMAGE_PATH = %r{\A/notes/[^"'\s>]+\.(?:png|jpe?g|gif|webp)\z}i
    IMAGE_EXTENSIONS = %w[.png .jpg .jpeg .gif .webp].freeze

    module_function

    def magick_available?
      @magick_available = system('which magick > /dev/null 2>&1') if @magick_available.nil?
      @magick_available
    end

    def note_image_source(site, src)
      return nil unless src.match?(NOTE_IMAGE_PATH)

      basename = File.basename(src)
      Dir.glob(File.join(site.source, '_notes', '**', basename)).find do |path|
        File.file?(path)
      end
    end

    def image_dimensions(path)
      return nil unless path && File.exist?(path)

      if magick_available?
        output = `magick identify -format '%w %h' #{Shellwords.escape(path)} 2>/dev/null`.strip
        if output.match?(/\A(\d+) (\d+)\z/)
          return ::Regexp.last_match(1).to_i, ::Regexp.last_match(2).to_i
        end
      end

      read_png_dimensions(path)
    end

    def read_png_dimensions(path)
      return nil unless path.end_with?('.png')

      File.open(path, 'rb') do |file|
        header = file.read(24)
        return nil unless header&.bytesize == 24
        return nil unless header[0, 8].unpack1('H*') == '89504e470d0a1a0a'

        [header[16, 4].unpack1('N'), header[20, 4].unpack1('N')]
      end
    rescue StandardError
      nil
    end

    def webp_path_for(src)
      src.sub(/\.(png|jpe?g|gif)\z/i, '.webp')
    end

    def convertible_to_webp?(src)
      src.match?(/\.(png|jpe?g|gif)\z/i)
    end

    def build_picture(site, src, attrs, loading:, fetchpriority: nil)
      webp_src = webp_path_for(src)
      use_webp = convertible_to_webp?(src)
      extra_attrs = []
      extra_attrs << %(loading="#{loading}")
      extra_attrs << %(decoding="async")
      extra_attrs << %(fetchpriority="#{fetchpriority}") if fetchpriority
      extra_attrs << %(sizes="(max-width: 768px) 100vw, 48rem")

      source_path = note_image_source(site, src)
      width, height = image_dimensions(source_path)
      extra_attrs << %(width="#{width}") if width
      extra_attrs << %(height="#{height}") if height

      cleaned_attrs = attrs
        .gsub(/\s(?:width|height|loading|decoding|fetchpriority|sizes)=["'][^"']*["']/i, '')
        .strip

      img_tag = "<img #{cleaned_attrs} #{extra_attrs.join(' ')}>".squeeze(' ')

      return img_tag unless use_webp

      <<~HTML.strip
        <picture>
          <source srcset="#{webp_src}" type="image/webp">
          #{img_tag}
        </picture>
      HTML
    end

    def optimize_html(site, html)
      image_index = 0

      html.gsub(/<img\b([^>]*?)>/i) do
        attrs = Regexp.last_match(1)
        src = attrs[/\bsrc=["']([^"']+)["']/i, 1]
        next Regexp.last_match(0) unless src&.match?(NOTE_IMAGE_PATH)

        image_index += 1
        loading = image_index == 1 ? 'eager' : 'lazy'
        fetchpriority = image_index == 1 ? 'high' : nil
        build_picture(site, src, attrs, loading: loading, fetchpriority: fetchpriority)
      end
    end

    def publish_note_images!(site)
      output_dir = File.join(site.dest, 'notes')
      FileUtils.mkdir_p(output_dir)

      pattern = File.join(site.source, '_notes', '**', '*.{png,jpg,jpeg,gif,webp}')
      Dir.glob(pattern).each do |source_path|
        next unless File.file?(source_path)
        next if source_path.include?('/Excalidraw/')

        basename = File.basename(source_path)
        ext = File.extname(basename).downcase
        next unless IMAGE_EXTENSIONS.include?(ext)

        dest_path = File.join(output_dir, basename)
        publish_image(source_path, dest_path)

        next if ext == '.webp'

        webp_path = dest_path.sub(/\.[^.]+\z/, '.webp')
        publish_webp(source_path, webp_path)
      end
    end

    def publish_image(source_path, dest_path)
      if magick_available?
        ext = File.extname(dest_path).downcase
        args = ['magick', source_path, '-strip']
        args.concat(['-define', 'png:compression-level=9']) if ext == '.png'
        args.concat(['-quality', '85']) if %w[.jpg .jpeg].include?(ext)
        args << dest_path
        return if system(*args)
      end

      FileUtils.cp(source_path, dest_path)
    end

    def publish_webp(source_path, webp_path)
      return unless magick_available?

      system('magick', source_path, '-quality', '82', webp_path)
    end

    def extract_first_image(content)
      return nil unless content

      if content.match(/!\[[^\]]*\]\((\/notes\/[^)]+)\)/)
        return ::Regexp.last_match(1)
      end

      nil
    end
  end
end

module Jekyll
  module NoteImagesFilters
    def optimize_note_images(input)
      site = @context.registers[:site]
      Jekyll::NoteImages.optimize_html(site, input.to_s)
    end
  end
end

Liquid::Template.register_filter(Jekyll::NoteImagesFilters)

Jekyll::Hooks.register :documents, :pre_render do |doc|
  next unless doc.data['content-type'] == 'notes'

  first_image = Jekyll::NoteImages.extract_first_image(doc.content)
  doc.data['first_image'] = first_image if first_image
end

Jekyll::Hooks.register :site, :post_write do |site|
  Jekyll::NoteImages.publish_note_images!(site)
end
