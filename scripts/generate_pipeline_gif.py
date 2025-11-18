#!/usr/bin/env python3
"""
Generate an animated GIF from the broken_pipeline.tex TikZ diagram.

Usage:
    python scripts/generate_pipeline_gif.py [--frames N] [--fps N] [--output-dir DIR] [--output FILE]
    
    Examples:
        python scripts/generate_pipeline_gif.py --frames 3
        python scripts/generate_pipeline_gif.py --frames 60 --fps 15
        python scripts/generate_pipeline_gif.py --frames 3 --output test.gif
        python scripts/generate_pipeline_gif.py --frames 3 --output-dir custom_dir

Requirements:
- pdflatex (LaTeX distribution with standalone class)
- ImageMagick (convert command)
- Python 3

The script will:
1. Generate multiple LaTeX frames with animated coin positions
2. Compile each frame to PDF
3. Convert PDFs to PNG images
4. Combine PNGs into a GIF
"""

import os
import subprocess
import shutil
import sys
import argparse
from pathlib import Path
from datetime import datetime

# Configuration
NUM_FRAMES = 60  # Number of frames for smooth animation
FPS = 15  # Frames per second for GIF
TEX_DIR = Path("data/archive/data_deals-neurips_camera_ready-latex")
# OUTPUT_DIR and OUTPUT_GIF will be set dynamically based on timestamp or user input

def check_dependencies():
    """Check if required tools are available."""
    tools = {
        'pdflatex': 'LaTeX compiler',
    }
    missing = []
    for tool, desc in tools.items():
        if not shutil.which(tool):
            missing.append(f"{tool} ({desc})")
    
    # Check for ImageMagick (magick or convert)
    if not (shutil.which('magick') or shutil.which('convert')):
        missing.append('magick or convert (ImageMagick for PDF to PNG conversion)')
    
    if missing:
        print("ERROR: Missing required tools:")
        for tool in missing:
            print(f"  - {tool}")
        print("\nInstallation:")
        print("  - LaTeX: sudo apt-get install texlive-full")
        print("  - ImageMagick: sudo apt-get install imagemagick")
        sys.exit(1)
    
    print("✓ All dependencies found")

def read_template():
    """Read the original broken_pipeline.tex file."""
    template_path = TEX_DIR / "figs" / "broken_pipeline.tex"
    with open(template_path, 'r') as f:
        return f.read()

def create_animated_frame(tex_content, frame_num, total_frames, speed_factor=1.0):
    """
    Modify the TikZ code to animate coins based on frame number.
    
    The animation moves coins along the horizontal pipeline.
    
    Args:
        tex_content: Original LaTeX TikZ content
        frame_num: Current frame number (0-indexed)
        total_frames: Total number of frames
        speed_factor: Speed multiplier (1.0 = default slow speed, 2.0 = 2x faster, 0.5 = 2x slower)
    """
    lines = tex_content.split('\n')
    animated_lines = []
    
    # Calculate animation progress (0 to 1, looping)
    # Use slower animation speed - reduce multiplier to make coins flow slower
    progress = (frame_num / total_frames) % 1.0
    # Base speeds (slow by default)
    BASE_ANIMATION_SPEED = 0.05
    BASE_VERTICAL_ANIMATION_SPEED = 0.041
    # Apply speed factor
    ANIMATION_SPEED = BASE_ANIMATION_SPEED * speed_factor
    VERTICAL_ANIMATION_SPEED = BASE_VERTICAL_ANIMATION_SPEED * speed_factor
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Replace the main coin loop (lines starting with \foreach \j in {12,...,58})
        if r'\foreach \j in {12,...,58}' in line:
            # Clog position: clogX = xB - 0.18, clogW = 0.9
            # Coins flow RIGHT TO LEFT (from xE toward xA)
            # Clog blocks flow, so:
            # - NO coins can be LEFT of clog (between xA and clogX) - physically impossible
            # - Coins BACK UP on RIGHT side of clog (between clogX and xE, near clog)
            # - Coins FLOW AFTER clog (between clogX+clogW and xE)
            
            animated_lines.append("  \\def\\clogX{\\xB-0.18}")
            animated_lines.append("  \\def\\clogW{0.9}")
            animated_lines.append("  \\pgfmathsetmacro{\\clogEnd}{\\clogX + \\clogW}")
            
            # Add animated coins that FLOW AFTER the clog (between clogEnd and xE)
            # These coins enter from xE (right side) and flow left toward clog
            # Coins pile up at the clog instead of disappearing
            animated_lines.append(f"  % Animated coins flowing AFTER clog (frame {frame_num + 1}/{total_frames}, progress={progress:.3f})")
            animated_lines.append("  \\pgfmathsetseed{42}  % Fixed seed for consistent random positions")
            # Create coins that continuously flow from xE toward clog
            # Skip coins near the opening (xE) to avoid artifacts
            animated_lines.append("  \\foreach \\j in {0,...,60} {")
            # Distribute coins evenly from clogEnd to xE-0.5 (skip opening area)
            # Start a bit away from clogEnd to show flow, end before xE to skip opening
            animated_lines.append("    \\pgfmathsetmacro{\\baseX}{\\clogEnd + 0.3 + \\j*(\\xE-0.5-\\clogEnd-0.3)/60}")
            # Move coins RIGHT TO LEFT (negative offset) based on progress - slower speed
            animated_lines.append(f"    \\pgfmathsetmacro{{\\animOffset}}{{-{progress} * {ANIMATION_SPEED} * (\\xE - \\clogEnd)}}")
            animated_lines.append("    \\pgfmathsetmacro{\\coinx}{\\baseX + \\animOffset}")
            # If coin goes past xE, wrap it back to just before xE (but skip the opening)
            animated_lines.append("    \\pgfmathparse{\\coinx > \\xE-0.5}")
            animated_lines.append("    \\ifnum\\pgfmathresult=1")
            animated_lines.append("      \\pgfmathsetmacro{\\excess}{\\coinx - (\\xE-0.5)}")
            animated_lines.append("      \\pgfmathsetmacro{\\wrapDist}{mod(\\excess, \\xE-0.5 - \\clogEnd)}")
            animated_lines.append("      \\pgfmathsetmacro{\\coinx}{\\clogEnd + \\wrapDist}")
            animated_lines.append("    \\fi")
            # If coin reaches or goes before clogEnd, stop it there (pile up effect)
            # Don't wrap - just accumulate at the clog
            animated_lines.append("    \\pgfmathparse{\\coinx < \\clogEnd}")
            animated_lines.append("    \\ifnum\\pgfmathresult=1")
            animated_lines.append("      \\pgfmathsetmacro{\\coinx}{\\clogEnd + 0.05}")
            animated_lines.append("    \\fi")
            # Only draw coins that are AFTER the clog and before the opening
            # Skip coins near xE (opening) to avoid artifacts
            animated_lines.append("    \\pgfmathparse{(\\coinx >= \\clogEnd) && (\\coinx <= \\xE-0.5) ? 1 : 0}")
            animated_lines.append("    \\ifnum\\pgfmathresult=1")
            animated_lines.append("      \\pgfmathsetmacro{\\coiny}{(rnd-0.5)*1.4*(\\rA-0.08)}")
            animated_lines.append("      \\pgfmathsetmacro{\\angle}{(rnd-0.5)*40}")
            animated_lines.append("      \\begin{scope}[shift={(\\coinx,\\coiny)}, rotate=\\angle]")
            animated_lines.append("        \\fill[coinyellow] (-0.3,-0.03) arc[start angle=180, end angle=360, x radius=0.3, y radius=0.06] -- (0.3,0.03) arc[start angle=0, end angle=180, x radius=0.3, y radius=0.06] -- cycle;")
            animated_lines.append("        \\fill[coinyellow] (0,0.03) ellipse [x radius=0.3, y radius=0.06];")
            animated_lines.append("        \\draw[black,thick] (0,0.03) ellipse [x radius=0.3, y radius=0.06];")
            animated_lines.append("        \\draw[black,thick] plot[domain=pi:2*pi,samples=30] ({0.3*cos(\\x r)}, {-0.03+0.06*sin(\\x r)});")
            animated_lines.append("        \\draw[black,thick] (-0.3,-0.03) -- (-0.3,0.03);")
            animated_lines.append("        \\draw[black,thick] (0.3,-0.03) -- (0.3,0.03);")
            animated_lines.append("      \\end{scope}")
            animated_lines.append("    \\fi")
            animated_lines.append("  }")
            
            # Add piled-up coins at the clog (accumulated coins that reached the clog)
            # These are static coins that accumulate over time as coins reach the clog
            # Coins pile up on the RIGHT side of the clog (just before clogEnd, where they hit the clog)
            animated_lines.append(f"  % Piled-up coins at clog (accumulated over time)")
            animated_lines.append("  \\pgfmathsetseed{44}  % Different seed for pile-up coins")
            # Number of coins in pile increases with progress (simulating accumulation)
            animated_lines.append(f"  \\pgfmathsetmacro{{\\pileCount}}{{int({progress} * 25)}}")
            animated_lines.append("  \\pgfmathparse{\\pileCount > 0 ? 1 : 0}")
            animated_lines.append("  \\ifnum\\pgfmathresult=1")
            animated_lines.append("    \\foreach \\k in {0,...,\\pileCount} {")
            # Distribute piled coins just before the clog (clogEnd area, on right side of clog)
            # Position them between clogEnd-0.3 and clogEnd (right before the clog)
            animated_lines.append("      \\pgfmathsetmacro{\\pileX}{\\clogEnd - 0.3 + \\k*0.25/\\pileCount}")
            animated_lines.append("      \\pgfmathsetmacro{\\pileY}{(rnd-0.5)*1.4*(\\rA-0.08)}")
            animated_lines.append("      \\pgfmathsetmacro{\\pileAngle}{(rnd-0.5)*40}")
            animated_lines.append("      \\begin{scope}[shift={(\\pileX,\\pileY)}, rotate=\\pileAngle]")
            animated_lines.append("        \\fill[coinyellow] (-0.3,-0.03) arc[start angle=180, end angle=360, x radius=0.3, y radius=0.06] -- (0.3,0.03) arc[start angle=0, end angle=180, x radius=0.3, y radius=0.06] -- cycle;")
            animated_lines.append("        \\fill[coinyellow] (0,0.03) ellipse [x radius=0.3, y radius=0.06];")
            animated_lines.append("        \\draw[black,thick] (0,0.03) ellipse [x radius=0.3, y radius=0.06];")
            animated_lines.append("        \\draw[black,thick] plot[domain=pi:2*pi,samples=30] ({0.3*cos(\\x r)}, {-0.03+0.06*sin(\\x r)});")
            animated_lines.append("        \\draw[black,thick] (-0.3,-0.03) -- (-0.3,0.03);")
            animated_lines.append("        \\draw[black,thick] (0.3,-0.03) -- (0.3,0.03);")
            animated_lines.append("      \\end{scope}")
            animated_lines.append("    }")
            animated_lines.append("  \\fi")
            # Skip the original loop lines until we find the closing brace
            i += 1
            brace_count = 1
            while i < len(lines) and brace_count > 0:
                line = lines[i]
                if '{' in line:
                    brace_count += line.count('{')
                if '}' in line:
                    brace_count -= line.count('}')
                i += 1
            continue
        
        # Skip coins after the clog (second \foreach \j in {1,...,7}) - these create artifacts at opening
        elif r'\foreach \j in {1,...,7}' in line and i > 100:  # Second occurrence (after clog)
            # Skip this loop entirely - it creates coins at the pipe opening which have artifacts
            # Skip the original loop
            i += 1
            brace_count = 1
            while i < len(lines) and brace_count > 0:
                line = lines[i]
                if '{' in line:
                    brace_count += line.count('{')
                if '}' in line:
                    brace_count -= line.count('}')
                i += 1
            continue
        
        # Animate vertical coin streams
        elif r'\drawCoinStreamVertical{' in line:
            # Extract the parameters and add animation offset
            # Format: \drawCoinStreamVertical{x}{y}{count}{spacing}{angle1}{angle2}{seed}
            # We'll animate the y position (coins fall down)
            parts = line.split('{')
            if len(parts) >= 8:  # Need all 7 parameters plus the command
                x_param = parts[1].split('}')[0]
                y_param = parts[2].split('}')[0]
                count_param = parts[3].split('}')[0]
                spacing_param = parts[4].split('}')[0]
                angle1_param = parts[5].split('}')[0]
                angle2_param = parts[6].split('}')[0]
                seed_param = parts[7].split('}')[0]
                
                # Animate vertical position (coins fall down)
                # Keep the same indentation as the original line
                indent = len(line) - len(line.lstrip())
                indent_str = ' ' * indent
                animated_lines.append(f"{indent_str}% Animated vertical coin stream (frame {frame_num + 1}/{total_frames})")
                # Adjust starting position - coins should fall DOWN
                # Original y values are 1, 0.8, 1 - these are in transformed coordinates
                # The scope is: [shift={(\centerX+.5,-.6*1.3)}, xscale=-1, rotate=180]
                # Since coordinates are rotated 180deg, POSITIVE offset makes coins fall DOWN visually
                animated_lines.append(f"{indent_str}\\pgfmathsetmacro{{\\animYOffset}}{{{progress} * {VERTICAL_ANIMATION_SPEED} * 1.0}}")
                # Adjust starting y position - coins should start HIGHER (less negative adjustment)
                # Original values of 1, 0.8, 1 need to be reduced but not too much - start higher, fall down
                # Use less negative adjustment so coins start higher up in the tube
                y_start_adjust = .1  # Start coins higher (higher value, lower starting position)
                animated_lines.append(f"{indent_str}\\pgfmathsetmacro{{\\adjustedY}}{{{y_param}+{y_start_adjust}+\\animYOffset}}")
                animated_lines.append(f"{indent_str}\\drawCoinStreamVertical{{{x_param}}}{{\\adjustedY}}{{{count_param}}}{{{spacing_param}}}{{{angle1_param}}}{{{angle2_param}}}{{{seed_param}}}")
            else:
                animated_lines.append(line)
            i += 1
            continue
        
        animated_lines.append(line)
        i += 1
    
    return '\n'.join(animated_lines)

def create_frame_document(frame_content):
    """Create a complete LaTeX document for a single frame."""
    # Read tikz_imports to get all the necessary definitions
    tikz_imports_path = TEX_DIR / "tikz_imports.tex"
    with open(tikz_imports_path, 'r') as f:
        tikz_imports = f.read()
    
    # Remove optional packages that aren't used in broken_pipeline.tex
    # Replace contour-related lines (not used in broken_pipeline.tex)
    tikz_imports_clean = tikz_imports.replace(
        '\\usepackage[outline]{contour} %',
        '% \\usepackage[outline]{contour} % Optional, not used in broken_pipeline'
    ).replace(
        '\\contourlength{1.1pt}',
        '% \\contourlength{1.1pt} % Optional'
    ).replace(
        '\\usepackage{physics}',
        '% \\usepackage{physics} % Optional, not used in broken_pipeline'
    )
    
    # Add white background - insert background rectangle style at the start of tikzpicture
    # The frame_content already starts with \begin{tikzpicture}, so we need to modify it
    # Check if tikzpicture exists and doesn't already have options
    if '\\begin{tikzpicture}' in frame_content:
        # Check if tikzpicture already has options (contains [)
        if '\\begin{tikzpicture}[' in frame_content:
            # Already has options, add to existing options
            frame_content_with_bg = frame_content.replace(
                '\\begin{tikzpicture}[',
                '\\begin{tikzpicture}[background rectangle/.style={fill=white}, show background rectangle, ',
                1
            )
        else:
            # No options, add them
            frame_content_with_bg = frame_content.replace(
                '\\begin{tikzpicture}',
                '\\begin{tikzpicture}[background rectangle/.style={fill=white}, show background rectangle]',
                1
            )
    else:
        frame_content_with_bg = frame_content
    
    standalone_doc = f"""\\documentclass[tikz]{{standalone}}
\\usepackage{{tikz}}
% Contour package is optional - not used in broken_pipeline.tex
% \\usepackage[outline]{{contour}}
\\usetikzlibrary{{patterns,decorations.pathmorphing}}
\\usetikzlibrary{{decorations.markings}}
\\usetikzlibrary{{arrows.meta}}
\\usetikzlibrary{{calc}}
\\tikzset{{>=latex}}
% \\contourlength{{1.1pt}}

{tikz_imports_clean}

\\begin{{document}}
{frame_content_with_bg}
\\end{{document}}"""
    
    return standalone_doc

def compile_frame(frame_num, total_frames, output_dir, speed_factor=1.0, density=300, scale=1.0):
    """Generate and compile a single frame.
    
    Args:
        frame_num: Frame number (0-indexed)
        total_frames: Total number of frames
        output_dir: Output directory for frames
        speed_factor: Animation speed multiplier
        density: DPI/resolution for PNG conversion (default: 300)
        scale: Scale factor for output size (default: 1.0, use 0.5 for 50% size, 2.0 for 200% size)
    """
    print(f"Frame {frame_num + 1:3d}/{total_frames}...", end=" ", flush=True)
    
    # Read template
    template = read_template()
    
    # Create animated version
    animated_content = create_animated_frame(template, frame_num, total_frames, speed_factor)
    
    # Create standalone document
    doc_content = create_frame_document(animated_content)
    
    # Write frame LaTeX file
    frame_tex = output_dir / f"frame_{frame_num:04d}.tex"
    with open(frame_tex, 'w') as f:
        f.write(doc_content)
    
    # Compile to PDF (run twice for proper references)
    # Run pdflatex from output_dir with the frame filename
    frame_filename = frame_tex.name
    for run in [1, 2]:
        result = subprocess.run(
            ['pdflatex', '-interaction=nonstopmode', frame_filename],
            capture_output=True,
            cwd=str(output_dir)
        )
        if result.returncode != 0:
            # Check if PDF was created anyway (sometimes warnings don't prevent PDF creation)
            pdf_file = output_dir / f"frame_{frame_num:04d}.pdf"
            if not pdf_file.exists() and run == 2:
                print(f"ERROR")
                # Show error from both stdout and stderr
                error_output = result.stdout.decode() + result.stderr.decode()
                # Extract the actual error message
                error_lines = error_output.split('\n')
                error_msg = '\n'.join([line for line in error_lines if 'Error' in line or '!' in line][-10:])
                if error_msg:
                    print(error_msg)
                else:
                    print(error_output[-500:])  # Last 500 chars if no clear error
                return False
    
    # Convert PDF to PNG
    pdf_file = output_dir / f"frame_{frame_num:04d}.pdf"
    png_file = output_dir / f"frame_{frame_num:04d}.png"
    
    # Calculate effective density (render at final resolution to avoid upscaling blur)
    effective_density = int(density * scale)
    
    # Use Ghostscript for high-resolution PDF rendering (more reliable than ImageMagick at very high densities)
    gs_cmd = shutil.which('gs')
    if gs_cmd and effective_density > 2000:
        # Use Ghostscript for very high densities (better quality)
        # Ghostscript command: -dNOPAUSE -dBATCH -sDEVICE=png16m -r<dpi> -sOutputFile=<output> <input>
        # First render to temporary file, then composite with white background
        temp_png = output_dir / f"frame_{frame_num:04d}_gs_temp.png"
        result = subprocess.run(
            [gs_cmd,
             '-dNOPAUSE', '-dBATCH', '-dQUIET',
             '-sDEVICE=png16m',  # 16-bit RGB PNG
             f'-r{effective_density}',  # Resolution in DPI
             '-dGraphicsAlphaBits=4',  # Anti-aliasing
             '-dTextAlphaBits=4',  # Text anti-aliasing
             f'-sOutputFile={temp_png}',
             str(pdf_file)],
            capture_output=True
        )
        
        if result.returncode != 0:
            print(f"ERROR (Ghostscript)")
            print(result.stderr.decode()[-500:])
            return False
        
        # Composite with white background using ImageMagick
        magick_cmd = shutil.which('magick') or 'convert'
        is_magick_v7 = 'magick' in magick_cmd or magick_cmd.endswith('/magick')
        if is_magick_v7:
            result = subprocess.run(
                [magick_cmd, str(temp_png),
                 '-background', 'white',
                 '-alpha', 'remove',
                 '-alpha', 'off',
                 '-define', 'png:compression-level=0',
                 '-define', 'png:compression-strategy=0',
                 str(png_file)],
                capture_output=True
            )
        else:
            result = subprocess.run(
                [magick_cmd, '-background', 'white', '-alpha', 'remove', '-alpha', 'off',
                 '-define', 'png:compression-level=0',
                 '-define', 'png:compression-strategy=0',
                 str(temp_png), str(png_file)],
                capture_output=True
            )
        
        if result.returncode != 0:
            print(f"ERROR (composite)")
            print(result.stderr.decode()[-500:])
            return False
        
        # Clean up temp file
        try:
            temp_png.unlink()
        except:
            pass
    else:
        # Use ImageMagick for normal densities or if Ghostscript not available
        magick_cmd = shutil.which('magick') or 'convert'
        is_magick_v7 = 'magick' in magick_cmd or magick_cmd.endswith('/magick')
        density_str = str(effective_density)
        
        if is_magick_v7:
            # ImageMagick v7 syntax: input first, then operations
            result = subprocess.run(
                [magick_cmd, str(pdf_file),
                 '-density', density_str,
                 '-background', 'white',
                 '-alpha', 'remove',
                 '-alpha', 'off',
                 '-define', 'png:compression-level=0',  # No compression for maximum quality
                 '-define', 'png:compression-strategy=0',
                 str(png_file)],
                capture_output=True
            )
        else:
            # ImageMagick v6 (convert) syntax: operations before input
            result = subprocess.run(
                [magick_cmd, '-density', density_str,
                 '-background', 'white', '-alpha', 'remove', '-alpha', 'off',
                 '-define', 'png:compression-level=0',
                 '-define', 'png:compression-strategy=0',
                 str(pdf_file), str(png_file)],
                capture_output=True
            )
        
        if result.returncode != 0:
            print(f"ERROR")
            print(result.stderr.decode()[-500:])
            return False
        
        # Ghostscript outputs PNGs without alpha channel, but ImageMagick might need cleanup
        # If using ImageMagick and we need white background, ensure it's applied
        if not gs_cmd or effective_density <= 2000:
            # Ensure white background is solid (ImageMagick should have handled this)
            pass
    
    print("✓")
    return True

def create_gif(num_frames, output_gif_path, fps, output_dir):
    """Combine PNG frames into a GIF."""
    print(f"\nCreating GIF from frames...")
    
    # Use ImageMagick to create GIF - only get frames up to num_frames
    # This ensures we only use the frames we just generated
    png_files = []
    for i in range(num_frames):
        png_file = output_dir / f"frame_{i:04d}.png"
        if png_file.exists():
            png_files.append(png_file)
        else:
            print(f"WARNING: Frame {i:04d}.png not found, skipping")
    
    if not png_files:
        print("ERROR: No PNG files found!")
        return False
    
    print(f"Found {len(png_files)} PNG files")
    
    # Create GIF with ImageMagick (try magick first for v7, fallback to convert)
    magick_cmd = shutil.which('magick') or 'convert'
    delay = int(100 / fps)  # Delay in 1/100 seconds
    
    # Convert paths to absolute paths for ImageMagick
    png_files_abs = [str(f.resolve()) for f in png_files]
    output_gif_abs = str(output_gif_path.resolve())
    
    # ImageMagick v7 syntax: -layers optimize must come after input images
    # Use Optimize (capitalized) for ImageMagick v7
    # Check if using magick (v7) vs convert (v6)
    is_magick_v7 = 'magick' in magick_cmd or magick_cmd.endswith('/magick')
    if is_magick_v7:
        # ImageMagick v7 syntax - use Optimize (capitalized) and place after inputs
        # Use -coalesce first to handle frames properly, then optimize
        # Use -dispose none to ensure full frames (prevents flickering artifacts)
        cmd = [
            magick_cmd,
            '-delay', str(delay),
            '-loop', '0',  # Loop forever
            '-dispose', 'none',  # Full frames to prevent flickering artifacts
        ] + png_files_abs + [
            '-coalesce',  # Coalesce frames to handle animation correctly
            '-layers', 'Optimize',  # Optimize for smaller file size (capitalized for v7)
            output_gif_abs
        ]
    else:
        # ImageMagick v6 (convert) syntax
        cmd = [
            magick_cmd,
            '-delay', str(delay),
            '-loop', '0',  # Loop forever
            '-dispose', 'none',  # Full frames to prevent flickering artifacts
            '-coalesce',  # Coalesce frames
            '-layers', 'optimize',  # Optimize for smaller file size
        ] + png_files_abs + [output_gif_abs]
    
    result = subprocess.run(cmd, capture_output=True)
    
    if result.returncode != 0:
        print("ERROR creating GIF")
        print(result.stderr.decode())
        return False
    
    size_mb = output_gif_path.stat().st_size / 1024 / 1024
    print(f"✓ GIF created: {output_gif_path}")
    print(f"  Size: {size_mb:.2f} MB")
    return True

def cleanup(output_dir):
    """Clean up intermediate files."""
    print("\nCleaning up intermediate files...")
    for ext in ['.tex', '.pdf', '.aux', '.log']:
        for f in output_dir.glob(f"frame_*{ext}"):
            try:
                f.unlink()
            except:
                pass
    print("✓ Cleanup complete")

def main():
    parser = argparse.ArgumentParser(
        description='Generate an animated GIF from the broken_pipeline.tex TikZ diagram',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Directory handling:
  - By default, creates a timestamped directory under TEX_DIR:
    data/archive/data_deals-neurips_camera_ready-latex/gif_frames_YYYYMMDD_HHMMSS/
  - All frame files (.tex, .pdf, .png, .aux, .log) are written to the output directory
  - The final GIF is written to the same output directory
  - Use --output-dir to specify a custom directory location
  - pdflatex runs from the output directory as the working directory
  - Only frames matching the specified count are used for GIF generation
        """
    )
    parser.add_argument(
        '--frames', '-f',
        type=int,
        default=NUM_FRAMES,
        help=f'Number of frames to generate (default: {NUM_FRAMES})'
    )
    parser.add_argument(
        '--fps',
        type=int,
        default=FPS,
        help=f'Frames per second for GIF (default: {FPS})'
    )
    parser.add_argument(
        '--output-dir',
        type=str,
        default=None,
        help='Output directory for frames and GIF (default: timestamped directory under TEX_DIR)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default=None,
        help='Output GIF filename (default: broken_pipeline_animated.gif, created in output-dir)'
    )
    parser.add_argument(
        '--speed',
        type=float,
        default=1.0,
        help='Animation speed multiplier (default: 1.0, use 2.0 for 2x faster, 0.5 for 2x slower)'
    )
    parser.add_argument(
        '--density',
        type=int,
        default=300,
        help='Resolution/DPI for PNG frames and GIF (default: 300, higher = better quality but larger files)'
    )
    parser.add_argument(
        '--scale',
        type=float,
        default=1.0,
        help='Scale factor for output size (default: 1.0, use 0.5 for 50%% size, 2.0 for 200%% size)'
    )
    
    args = parser.parse_args()
    
    num_frames = args.frames
    fps = args.fps
    
    # Determine output directory
    if args.output_dir:
        # User specified directory
        output_dir = Path(args.output_dir)
        if not output_dir.is_absolute():
            # Relative to repo root
            output_dir = Path(output_dir)
    else:
        # Create timestamped directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = TEX_DIR / f"gif_frames_{timestamp}"
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Handle output GIF path - if relative, make it relative to output_dir
    if args.output:
        output_gif = Path(args.output)
        if not output_gif.is_absolute():
            # If it's just a filename, put it in output_dir
            if '/' not in str(output_gif) and '\\' not in str(output_gif):
                output_gif = output_dir / output_gif
            else:
                # Relative path from repo root
                output_gif = Path(output_gif)
    else:
        # Default filename in output_dir
        output_gif = output_dir / "broken_pipeline_animated.gif"
    
    print("=" * 60)
    print("TikZ Pipeline GIF Generator")
    print("=" * 60)
    print(f"Frames: {num_frames}, FPS: {fps}, Speed: {args.speed}x, Density: {args.density} DPI, Scale: {args.scale}x")
    print(f"Output directory: {output_dir}")
    print(f"Output GIF: {output_gif}")
    print("=" * 60)
    
    # Check dependencies
    check_dependencies()
    
    # Generate frames
    print(f"\nGenerating {num_frames} frames...")
    success_count = 0
    for i in range(num_frames):
        if compile_frame(i, num_frames, output_dir, args.speed, args.density, args.scale):
            success_count += 1
    
    if success_count != num_frames:
        print(f"\nWARNING: Only {success_count}/{num_frames} frames generated successfully")
        if success_count == 0:
            print("ERROR: No frames generated. Aborting.")
            return
    
    # Create GIF
    if create_gif(num_frames, output_gif, fps, output_dir):
        print("\n" + "=" * 60)
        print("SUCCESS! Animated GIF created.")
        print(f"Output: {output_gif}")
        print("=" * 60)
        
        # Optionally cleanup
        try:
            response = input("\nClean up intermediate files? (y/n): ").strip().lower()
            if response == 'y':
                cleanup(output_dir)
        except:
            pass
    else:
        print("\nERROR: Failed to create GIF")

if __name__ == "__main__":
    main()
