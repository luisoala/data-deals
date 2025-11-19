#!/usr/bin/env python3
"""
Generate an animated GIF from the broken_pipeline.tex TikZ diagram.

Usage:
    python scripts/generate_pipeline_gif.py [OPTIONS]
    
    Examples:
        python scripts/generate_pipeline_gif.py --frames 3
        python scripts/generate_pipeline_gif.py --frames 60 --fps 15 --speed 2.0
        python scripts/generate_pipeline_gif.py --frames 60 --density 600 --scale 4
        python scripts/generate_pipeline_gif.py --frames 3 --output test.gif

Requirements:
- pdflatex (LaTeX distribution with standalone class)
- Ghostscript (gs) - preferred for PDF to PNG conversion
- ImageMagick (magick or convert) - required for GIF creation and fallback PDF conversion
- Python 3

The script will:
1. Generate multiple LaTeX frames with animated coin positions
2. Compile each frame to PDF
3. Convert PDFs to PNG images (using Ghostscript if available, else ImageMagick)
4. Combine PNGs into a GIF
"""

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

# Animation constants
BASE_ANIMATION_SPEED = 0.05
BASE_VERTICAL_ANIMATION_SPEED = 0.041
HORIZONTAL_COIN_COUNT = 60
PILE_COIN_MAX = 25
VERTICAL_Y_START_ADJUST = 0.1

def check_dependencies():
    """Check if required tools are available."""
    missing = []
    
    # Required: pdflatex
    if not shutil.which('pdflatex'):
        missing.append('pdflatex (LaTeX compiler)')
    
    # Required: ImageMagick (for GIF creation and fallback PDF conversion)
    if not (shutil.which('magick') or shutil.which('convert')):
        missing.append('magick or convert (ImageMagick)')
    
    # Optional but recommended: Ghostscript (better PDF rendering quality)
    gs_available = shutil.which('gs')
    if not gs_available:
        print("WARNING: Ghostscript (gs) not found. Will use ImageMagick for PDF conversion.")
        print("  For better quality, install: sudo apt-get install ghostscript")
    else:
        print("✓ Ghostscript found (will be used for PDF conversion)")
    
    if missing:
        print("ERROR: Missing required tools:")
        for tool in missing:
            print(f"  - {tool}")
        print("\nInstallation:")
        print("  - LaTeX: sudo apt-get install texlive-full")
        print("  - ImageMagick: sudo apt-get install imagemagick")
        print("  - Ghostscript: sudo apt-get install ghostscript (recommended)")
        sys.exit(1)
    
    print("✓ All required dependencies found")

def read_template():
    """Read the original broken_pipeline.tex file."""
    template_path = TEX_DIR / "figs" / "broken_pipeline.tex"
    with open(template_path, 'r') as f:
        return f.read()

def get_coin_drawing_code():
    """Return TikZ code for drawing a single coin."""
    return [
        "        \\fill[coinyellow] (-0.3,-0.03) arc[start angle=180, end angle=360, x radius=0.3, y radius=0.06] -- (0.3,0.03) arc[start angle=0, end angle=180, x radius=0.3, y radius=0.06] -- cycle;",
        "        \\fill[coinyellow] (0,0.03) ellipse [x radius=0.3, y radius=0.06];",
        "        \\draw[black,thick] (0,0.03) ellipse [x radius=0.3, y radius=0.06];",
        "        \\draw[black,thick] plot[domain=pi:2*pi,samples=30] ({0.3*cos(\\x r)}, {-0.03+0.06*sin(\\x r)});",
        "        \\draw[black,thick] (-0.3,-0.03) -- (-0.3,0.03);",
        "        \\draw[black,thick] (0.3,-0.03) -- (0.3,0.03);"
    ]

def skip_loop(lines, start_idx):
    """
    Skip a LaTeX loop block by counting braces.
    
    Returns the index after the closing brace of the loop.
    """
    i = start_idx + 1
    brace_count = 1
    while i < len(lines) and brace_count > 0:
        line = lines[i]
        brace_count += line.count('{')
        brace_count -= line.count('}')
        i += 1
    return i

def create_animated_frame(tex_content, frame_num, total_frames, speed_factor=1.0):
    """
    Modify the TikZ code to animate coins based on frame number.
    
    The animation moves coins along the horizontal pipeline and vertical streams.
    
    Args:
        tex_content: Original LaTeX TikZ content
        frame_num: Current frame number (0-indexed)
        total_frames: Total number of frames
        speed_factor: Speed multiplier (1.0 = default slow speed, 2.0 = 2x faster, 0.5 = 2x slower)
    """
    lines = tex_content.split('\n')
    animated_lines = []
    
    # Calculate animation progress (0 to 1, looping)
    progress = (frame_num / total_frames) % 1.0
    
    # Apply speed factor to base speeds
    animation_speed = BASE_ANIMATION_SPEED * speed_factor
    vertical_animation_speed = BASE_VERTICAL_ANIMATION_SPEED * speed_factor
    
    coin_drawing = get_coin_drawing_code()
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Replace the main coin loop
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
            
            # Add animated coins that FLOW AFTER the clog
            animated_lines.append(f"  % Animated coins flowing AFTER clog (frame {frame_num + 1}/{total_frames}, progress={progress:.3f})")
            animated_lines.append("  \\pgfmathsetseed{42}  % Fixed seed for consistent random positions")
            animated_lines.append(f"  \\foreach \\j in {{0,...,{HORIZONTAL_COIN_COUNT}}} {{")
            # Distribute coins evenly from clogEnd to xE-0.5 (skip opening area)
            animated_lines.append("    \\pgfmathsetmacro{\\baseX}{\\clogEnd + 0.3 + \\j*(\\xE-0.5-\\clogEnd-0.3)/" + str(HORIZONTAL_COIN_COUNT) + "}")
            # Move coins RIGHT TO LEFT (negative offset) based on progress
            animated_lines.append(f"    \\pgfmathsetmacro{{\\animOffset}}{{-{progress} * {animation_speed} * (\\xE - \\clogEnd)}}")
            animated_lines.append("    \\pgfmathsetmacro{\\coinx}{\\baseX + \\animOffset}")
            # If coin goes past xE, wrap it back
            animated_lines.append("    \\pgfmathparse{\\coinx > \\xE-0.5}")
            animated_lines.append("    \\ifnum\\pgfmathresult=1")
            animated_lines.append("      \\pgfmathsetmacro{\\excess}{\\coinx - (\\xE-0.5)}")
            animated_lines.append("      \\pgfmathsetmacro{\\wrapDist}{mod(\\excess, \\xE-0.5 - \\clogEnd)}")
            animated_lines.append("      \\pgfmathsetmacro{\\coinx}{\\clogEnd + \\wrapDist}")
            animated_lines.append("    \\fi")
            # If coin reaches clogEnd, stop it there (pile up effect)
            animated_lines.append("    \\pgfmathparse{\\coinx < \\clogEnd}")
            animated_lines.append("    \\ifnum\\pgfmathresult=1")
            animated_lines.append("      \\pgfmathsetmacro{\\coinx}{\\clogEnd + 0.05}")
            animated_lines.append("    \\fi")
            # Only draw coins that are AFTER the clog and before the opening
            animated_lines.append("    \\pgfmathparse{(\\coinx >= \\clogEnd) && (\\coinx <= \\xE-0.5) ? 1 : 0}")
            animated_lines.append("    \\ifnum\\pgfmathresult=1")
            animated_lines.append("      \\pgfmathsetmacro{\\coiny}{(rnd-0.5)*1.4*(\\rA-0.08)}")
            animated_lines.append("      \\pgfmathsetmacro{\\angle}{(rnd-0.5)*40}")
            animated_lines.append("      \\begin{scope}[shift={(\\coinx,\\coiny)}, rotate=\\angle]")
            animated_lines.extend(coin_drawing)
            animated_lines.append("      \\end{scope}")
            animated_lines.append("    \\fi")
            animated_lines.append("  }")
            
            # Add piled-up coins at the clog (accumulated coins that reached the clog)
            animated_lines.append(f"  % Piled-up coins at clog (accumulated over time)")
            animated_lines.append("  \\pgfmathsetseed{44}  % Different seed for pile-up coins")
            animated_lines.append(f"  \\pgfmathsetmacro{{\\pileCount}}{{int({progress} * {PILE_COIN_MAX})}}")
            animated_lines.append("  \\pgfmathparse{\\pileCount > 0 ? 1 : 0}")
            animated_lines.append("  \\ifnum\\pgfmathresult=1")
            animated_lines.append("    \\foreach \\k in {0,...,\\pileCount} {")
            # Distribute piled coins just before the clog
            animated_lines.append("      \\pgfmathsetmacro{\\pileX}{\\clogEnd - 0.3 + \\k*0.25/\\pileCount}")
            animated_lines.append("      \\pgfmathsetmacro{\\pileY}{(rnd-0.5)*1.4*(\\rA-0.08)}")
            animated_lines.append("      \\pgfmathsetmacro{\\pileAngle}{(rnd-0.5)*40}")
            animated_lines.append("      \\begin{scope}[shift={(\\pileX,\\pileY)}, rotate=\\pileAngle]")
            animated_lines.extend(coin_drawing)
            animated_lines.append("      \\end{scope}")
            animated_lines.append("    }")
            animated_lines.append("  \\fi")
            
            # Skip the original loop
            i = skip_loop(lines, i)
            continue
        
        # Skip coins after the clog (second \foreach \j in {1,...,7}) - these create artifacts at opening
        elif r'\foreach \j in {1,...,7}' in line and i > 100:  # Second occurrence (after clog)
            i = skip_loop(lines, i)
            continue
        
        # Animate vertical coin streams
        elif r'\drawCoinStreamVertical{' in line:
            # Extract the parameters and add animation offset
            # Format: \drawCoinStreamVertical{x}{y}{count}{spacing}{angle1}{angle2}{seed}
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
                indent = len(line) - len(line.lstrip())
                indent_str = ' ' * indent
                animated_lines.append(f"{indent_str}% Animated vertical coin stream (frame {frame_num + 1}/{total_frames})")
                # Since coordinates are rotated 180deg, POSITIVE offset makes coins fall DOWN visually
                animated_lines.append(f"{indent_str}\\pgfmathsetmacro{{\\animYOffset}}{{{progress} * {vertical_animation_speed} * 1.0}}")
                animated_lines.append(f"{indent_str}\\pgfmathsetmacro{{\\adjustedY}}{{{y_param}+{VERTICAL_Y_START_ADJUST}+\\animYOffset}}")
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
    
    # Add white background to tikzpicture
    if '\\begin{tikzpicture}' in frame_content:
        if '\\begin{tikzpicture}[' in frame_content:
            frame_content_with_bg = frame_content.replace(
                '\\begin{tikzpicture}[',
                '\\begin{tikzpicture}[background rectangle/.style={fill=white}, show background rectangle, ',
                1
            )
        else:
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

def is_magick_v7(magick_cmd):
    """Check if ImageMagick command is v7 (magick) or v6 (convert)."""
    return 'magick' in magick_cmd or magick_cmd.endswith('/magick')

def composite_with_white_background(input_png, output_png):
    """
    Composite PNG with white background using ImageMagick.
    
    Returns True on success, False on failure.
    """
    magick_cmd = shutil.which('magick') or 'convert'
    is_v7 = is_magick_v7(magick_cmd)
    
    if is_v7:
        result = subprocess.run(
            [magick_cmd, str(input_png),
             '-background', 'white',
             '-alpha', 'remove',
             '-alpha', 'off',
             '-define', 'png:compression-level=0',
             '-define', 'png:compression-strategy=0',
             str(output_png)],
            capture_output=True
        )
    else:
        result = subprocess.run(
            [magick_cmd, '-background', 'white', '-alpha', 'remove', '-alpha', 'off',
             '-define', 'png:compression-level=0',
             '-define', 'png:compression-strategy=0',
             str(input_png), str(output_png)],
            capture_output=True
        )
    
    if result.returncode != 0:
        print(f"ERROR (composite)")
        print(result.stderr.decode()[-500:])
        return False
    return True

def convert_pdf_to_png_ghostscript(pdf_file, png_file, density):
    """
    Convert PDF to PNG using Ghostscript.
    
    Returns True on success, False on failure.
    """
    gs_cmd = shutil.which('gs')
    if not gs_cmd:
        return False
    
    temp_png = pdf_file.parent / f"{pdf_file.stem}_gs_temp.png"
    
    result = subprocess.run(
        [gs_cmd,
         '-dNOPAUSE', '-dBATCH', '-dQUIET',
         '-sDEVICE=png16m',  # 16-bit RGB PNG
         f'-r{density}',  # Resolution in DPI
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
    
    # Composite with white background
    success = composite_with_white_background(temp_png, png_file)
    
    # Clean up temp file
    try:
        temp_png.unlink()
    except:
        pass
    
    return success

def convert_pdf_to_png_imagemagick(pdf_file, png_file, density):
    """
    Convert PDF to PNG using ImageMagick.
    
    Returns True on success, False on failure.
    """
    magick_cmd = shutil.which('magick') or 'convert'
    is_v7 = is_magick_v7(magick_cmd)
    
    if is_v7:
        result = subprocess.run(
            [magick_cmd, str(pdf_file),
             '-density', str(density),
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
            [magick_cmd, '-density', str(density),
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
    return True

def compile_frame(frame_num, total_frames, output_dir, speed_factor=1.0, density=300, scale=1.0):
    """
    Generate and compile a single frame.
    
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
    frame_filename = frame_tex.name
    for run in [1, 2]:
        result = subprocess.run(
            ['pdflatex', '-interaction=nonstopmode', frame_filename],
            capture_output=True,
            cwd=str(output_dir)
        )
        if result.returncode != 0:
            pdf_file = output_dir / f"frame_{frame_num:04d}.pdf"
            if not pdf_file.exists() and run == 2:
                print(f"ERROR")
                error_output = result.stdout.decode() + result.stderr.decode()
                error_lines = error_output.split('\n')
                error_msg = '\n'.join([line for line in error_lines if 'Error' in line or '!' in line][-10:])
                if error_msg:
                    print(error_msg)
                else:
                    print(error_output[-500:])
                return False
    
    # Convert PDF to PNG
    pdf_file = output_dir / f"frame_{frame_num:04d}.pdf"
    png_file = output_dir / f"frame_{frame_num:04d}.png"
    
    # Calculate effective density (render at final resolution to avoid upscaling blur)
    effective_density = int(density * scale)
    
    # Try Ghostscript first (better quality), fall back to ImageMagick
    if not convert_pdf_to_png_ghostscript(pdf_file, png_file, effective_density):
        if not convert_pdf_to_png_imagemagick(pdf_file, png_file, effective_density):
            return False
    
    print("✓")
    return True

def create_gif(num_frames, output_gif_path, fps, output_dir):
    """Combine PNG frames into a GIF."""
    print(f"\nCreating GIF from frames...")
    
    # Collect PNG files
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
    
    # Create GIF with ImageMagick
    magick_cmd = shutil.which('magick') or 'convert'
    delay = int(100 / fps)  # Delay in 1/100 seconds
    
    png_files_abs = [str(f.resolve()) for f in png_files]
    output_gif_abs = str(output_gif_path.resolve())
    
    is_v7 = is_magick_v7(magick_cmd)
    if is_v7:
        cmd = [
            magick_cmd,
            '-delay', str(delay),
            '-loop', '0',
            '-dispose', 'none',  # Full frames to prevent flickering artifacts
        ] + png_files_abs + [
            '-coalesce',
            '-layers', 'Optimize',  # Capitalized for v7
            output_gif_abs
        ]
    else:
        cmd = [
            magick_cmd,
            '-delay', str(delay),
            '-loop', '0',
            '-dispose', 'none',
            '-coalesce',
            '-layers', 'optimize',  # Lowercase for v6
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
    
    # Determine output directory
    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = TEX_DIR / f"gif_frames_{timestamp}"
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Handle output GIF path
    if args.output:
        output_gif = Path(args.output)
        if not output_gif.is_absolute():
            if '/' not in str(output_gif) and '\\' not in str(output_gif):
                output_gif = output_dir / output_gif
    else:
        output_gif = output_dir / "broken_pipeline_animated.gif"
    
    print("=" * 60)
    print("TikZ Pipeline GIF Generator")
    print("=" * 60)
    print(f"Frames: {args.frames}, FPS: {args.fps}, Speed: {args.speed}x, Density: {args.density} DPI, Scale: {args.scale}x")
    print(f"Output directory: {output_dir}")
    print(f"Output GIF: {output_gif}")
    print("=" * 60)
    
    # Check dependencies
    check_dependencies()
    
    # Generate frames
    print(f"\nGenerating {args.frames} frames...")
    success_count = 0
    for i in range(args.frames):
        if compile_frame(i, args.frames, output_dir, args.speed, args.density, args.scale):
            success_count += 1
    
    if success_count != args.frames:
        print(f"\nWARNING: Only {success_count}/{args.frames} frames generated successfully")
        if success_count == 0:
            print("ERROR: No frames generated. Aborting.")
            return
    
    # Create GIF
    if create_gif(args.frames, output_gif, args.fps, output_dir):
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
