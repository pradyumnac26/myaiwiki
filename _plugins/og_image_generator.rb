# frozen_string_literal: true

require 'fileutils'
require 'net/http'
require 'uri'

module Jekyll
  module OgImageGenerator
    WIDTH = 1200
    HEIGHT = 630
    BG = '#FFFCF0'
    TITLE_COLOR = '#343331'
    BRAND = '#3AA99F'
    PUBLIC_PATH = '/Public/'
    FONT_URL = 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf'

    module_function

    def note_documents(site)
      site.collections['notes']&.docs || []
    end

    def public_notes(site)
      note_documents(site).select do |note|
        note.data['feed'] == 'show' && note.path.include?(PUBLIC_PATH)
      end
    end

    def slug_for(note)
      note.url.to_s.split('/').reject(&:empty?).last
    end

    def title_for(note)
      note.data['title'].to_s.strip
    end

    def font_path(site)
      cache_dir = File.join(site.source, '.cache', 'og-fonts')
      font_file = File.join(cache_dir, 'Inter-SemiBold.ttf')
      return font_file if File.exist?(font_file)

      FileUtils.mkdir_p(cache_dir)
      download_file(FONT_URL, font_file) ? font_file : nil
    end

    def download_file(url, destination)
      uri = URI(url)
      Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') do |http|
        response = http.get(uri.request_uri)
        return false unless response.is_a?(Net::HTTPSuccess)

        File.binwrite(destination, response.body)
      end
      true
    rescue StandardError => e
      Jekyll.logger.warn 'OG Images:', "Font download failed (#{e.message})"
      false
    end

    def title_lines(title, max_chars: 28, max_lines: 3)
      words = title.split(/\s+/)
      lines = []
      current = +''

      words.each do |word|
        candidate = current.empty? ? word : "#{current} #{word}"
        if candidate.length <= max_chars
          current = candidate
        else
          lines << current unless current.empty?
          current = word
        end
      end

      lines << current unless current.empty?
      lines = lines.first(max_lines)

      if lines.length == max_lines && words.join(' ').length > lines.join(' ').length
        lines[-1] = "#{lines[-1][0, max_chars - 1]}…"
      end

      lines
    end

    def font_size_for(lines)
      longest = lines.map(&:length).max || 0
      return 48 if lines.length > 2 || longest > 24
      return 56 if longest > 18

      64
    end

    def accent_y_for(line_count, font_size)
      center = HEIGHT / 2
      text_block = line_count * (font_size * 1.25)
      [center + (text_block / 2) + 36, HEIGHT - 120].min
    end

    def magick_available?
      @magick_available = system('which magick > /dev/null 2>&1') if @magick_available.nil?
      @magick_available
    end

    def write_png(site, title, png_path)
      unless magick_available?
        Jekyll.logger.warn 'OG Images:', 'ImageMagick (magick) not found; skipping PNG generation'
        return false
      end

      font = font_path(site)
      unless font && File.exist?(font)
        Jekyll.logger.warn 'OG Images:', 'Inter font unavailable; skipping PNG generation'
        return false
      end

      lines = title_lines(title)
      font_size = font_size_for(lines)
      label = lines.join("\n")
      accent_y = accent_y_for(lines.length, font_size)

      args = [
        'magick',
        '-size', "#{WIDTH}x#{HEIGHT}",
        "xc:#{BG}",
        '-font', font,
        '-pointsize', font_size.to_s,
        '-fill', TITLE_COLOR,
        '-gravity', 'center',
        '-annotate', '0', label,
        '-fill', BRAND,
        '-draw', "roundrectangle 520,#{accent_y} 680,#{accent_y + 4} 2,2",
        png_path
      ]

      if system(*args)
        true
      else
        Jekyll.logger.warn 'OG Images:', "Failed to generate #{File.basename(png_path)}"
        false
      end
    end

    def build!(site)
      output_dir = File.join(site.dest, 'assets', 'og')
      FileUtils.mkdir_p(output_dir)

      public_notes(site).each do |note|
        title = title_for(note)
        next if title.empty?

        slug = slug_for(note)
        png_path = File.join(output_dir, "#{slug}.png")
        next unless write_png(site, title, png_path)

        Jekyll.logger.info 'OG Images:', "Generated #{slug}.png"
      end

      site_title = site.config['title'] || site.config['heading'] || 'MyAIWiki'
      site_png = File.join(output_dir, 'site.png')
      if write_png(site, site_title, site_png)
        Jekyll.logger.info 'OG Images:', 'Generated site.png'
      end
    end
  end
end

Jekyll::Hooks.register :site, :post_write do |site|
  Jekyll::OgImageGenerator.build!(site)
end
