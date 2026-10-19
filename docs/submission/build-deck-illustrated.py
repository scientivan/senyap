"""Build the illustrated edition with static, inline SVG explanations."""
from pathlib import Path
from html import escape, unescape
import base64, re, json

ROOT = Path(__file__).parent
INK, GOLD, RED, LINE = '#2A1B1B', '#AE9970', '#C1272D', '#E4DFDF'
notes = json.loads((ROOT/'deck-presenter-notes.json').read_text())
ICONS = {
'ecosystem':'<path d="M14 36 50 16l36 20H14ZM20 82h60M24 42v32m17-32v32m18-32v32m17-32v32M15 88h70"/>',
'builder':'<rect x="17" y="23" width="66" height="47" rx="5"/><path d="m8 80 9-10h66l9 10H8Zm31-42-9 9 9 9m22-18 9 9-9 9"/>',
'scouts':'<circle cx="50" cy="30" r="12"/><circle cx="20" cy="40" r="9"/><circle cx="80" cy="40" r="9"/><path d="M30 80V65a20 20 0 0 1 40 0v15M6 78V66a14 14 0 0 1 19-13m69 25V66a14 14 0 0 0-19-13"/>',
'buyer':'<path d="M20 30h60a8 8 0 0 1 8 8v39a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V38a8 8 0 0 1 8-8Zm17 0v-9h26v9M12 49h76M43 49v12h14V49"/>',
'lock':'<rect x="23" y="44" width="54" height="43" rx="7"/><path d="M33 44V30a17 17 0 0 1 34 0v14M50 61v10"/>',
'signal':'<path d="M23 75V25m18 50V38m18 37V48m18 27V58" stroke-width="9"/>',
'shield':'<path d="M50 10 84 24v26c0 20-13 34-34 43-21-9-34-23-34-43V24L50 10Z"/><path d="m34 50 11 11 23-25"/>',
'sealed':'<path d="M50 10 84 24v26c0 20-13 34-34 43-21-9-34-23-34-43V24L50 10Z"/>',
'key':'<circle cx="34" cy="36" r="19"/><path d="m47 50 36 36m-17-17 9-9m0 18 9-9"/>',
'coins':'<ellipse cx="43" cy="28" rx="29" ry="12"/><path d="M14 28v17c0 7 13 12 29 12s29-5 29-12V28M14 45v17c0 7 13 12 29 12M14 62v14c0 7 13 12 29 12"/><circle cx="70" cy="70" r="22"/>',
'receipt':'<path d="M26 12h38l14 14v62H26V12Zm38 0v16h14M38 41h26M38 52h19m-16 16 7 7 16-16"/>',
'clock':'<circle cx="50" cy="50" r="35"/><path d="M50 27v24l17 10"/>',
'proof':'<path d="m50 9 35 20v42L50 91 15 71V29L50 9Z"/><path d="m32 50 12 12 25-27"/>',
'chain':'<path d="m40 60-7 7a17 17 0 0 1-24-24l18-18a17 17 0 0 1 24 0m9 15 7-7a17 17 0 0 1 24 24L73 75a17 17 0 0 1-24 0M34 66l32-32"/>',
'server':'<rect x="16" y="15" width="68" height="29" rx="5"/><rect x="16" y="56" width="68" height="29" rx="5"/><path d="M29 29h2m11 0h2m-15 41h2m11 0h2M61 29h10M61 70h10"/>',
'browser':'<rect x="9" y="17" width="82" height="68" rx="6"/><path d="M9 34h82M21 26h1m9 0h1m9 0h1M32 50 21 61l11 11m36-22 11 11-11 11"/>',
'filter':'<path d="M12 20h76L60 53v25l-20 9V53L12 20Z"/>',
'eye':'<path d="M8 50s15-27 42-27 42 27 42 27-15 27-42 27S8 50 8 50Z"/><circle cx="50" cy="50" r="12"/>',
'document':'<path d="M24 12h40l14 14v62H24V12Zm40 0v16h14M36 43h30M36 56h30M36 69h22"/>',
'flag':'<path d="M25 90V15m0 5c23-18 27 18 53 0v42c-25 18-29-18-53 0"/>',
'cancel':'<circle cx="50" cy="50" r="35"/><path d="m36 36 28 28m0-28L36 64"/>',
'refund':'<path d="M22 40a31 31 0 1 1 0 27M22 17v23h23M50 39v28m-9-22c0-8 20-8 20 0s-20 6-20 15 20 8 20 0"/>',
'replay':'<path d="M21 38a32 32 0 0 1 56-9M77 9v20H57M79 62a32 32 0 0 1-56 9M23 91V71h20"/>',
'check':'<circle cx="50" cy="50" r="35"/><path d="m30 50 14 14 28-30"/>',
'search':'<circle cx="42" cy="40" r="25"/><path d="m61 60 25 25M30 40h24M42 28v24"/>',
'chat':'<path d="M17 17h66v50H45L25 84V67h-8V17ZM30 33h40M30 46h30"/>',
}
def t(x,y,words,size=25,color='var(--ink)',weight=400,anchor='middle'):
    words=[words] if isinstance(words,str) else words
    return f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}">'+''.join(f'<tspan x="{x}" dy="{0 if i==0 else size*1.35}">{escape(str(s))}</tspan>' for i,s in enumerate(words))+'</text>'
def icon(name,x,y,size=100,color=GOLD):
    return f'<g transform="translate({x-size/2} {y-size/2}) scale({size/100})" fill="none" stroke="{color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</g>'
def p(d,color=GOLD,arrow=True,dashed=False):
    dash='stroke-dasharray="8 8"' if dashed else ''
    end='marker-end="url(#arrow)"' if arrow else ''
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="3" {dash} {end}/>'
def line(x,y,xx,yy,color=GOLD,arrow=True,dashed=False):return p(f'M{x} {y}L{xx} {yy}',color,arrow,dashed)
def rule(y):return line(0,y,1456,y,LINE,False)
def node(im,x,y,title,detail=None,size=108,color=GOLD):
    return icon(im,x,y,size,color)+t(x,y+size/2+40,title,29,weight=500)+(t(x,y+size/2+79,detail,23,'var(--muted)') if detail else '')
def svg(a,label,height=520):
    return f'<svg class="diagram" viewBox="0 0 1456 {height}" role="img" aria-label="{escape(label)}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="{GOLD}" stroke-width="1.5"/></marker></defs>{a}</svg>'
slides=[]
note_cursor=0
def slide(title,a,label,caption='',night=False,raw=False,extra='',new=False):
    global note_cursor
    n=len(slides)+1
    note=(notes[note_cursor] if not new and len(notes)>note_cursor else '')
    if not new: note_cursor+=1
    if extra and extra not in note: note+=' '+extra
    labeltitle=re.sub('<[^>]+>',' ',title)
    slides.append(f'<section data-document-role="page" data-label="{escape(labeltitle)}" data-speaker-notes="{escape(note)}" class="page {"night" if night else ""}"><header><span class="brand"><i></i><b></b><em></em>Senyap</span><span>Midnight · Wave 2</span></header><main><h1>{title}</h1>{a if raw else svg(a,label)}<p class="caption">{caption}</p></main><footer><span>Senyap · Private signals with accountable stakes</span><span>{n:02d}</span></footer></section>')

a=icon('scouts',770,130,95)+icon('scouts',770,340,95)
a+=p('M840 130H940L1000 220')+p('M840 340H940L1000 250')
a+=icon('sealed',1090,230,200)+icon('lock',1090,230,75,RED)
a+=line(1195,230,1300,230)+icon('signal',1370,230,108)
a+=t(770,425,'Private scouts',24)+t(1090,425,'Sealed picks',24)+t(1370,425,['Aggregate','signal'],24)
a+=t(0,92,['A private signal market','on Midnight.'],36,anchor='start')
a+=t(0,208,['Insiders stake a private pick.','Buyers open the combined signal.'],26,'var(--muted)',anchor='start')
a+=t(0,365,'Working Preprod prototype',24,GOLD,500,'start')
slide('Hear the signal.<br>Never the source.',a,'Many private scouts feed sealed picks, releasing one aggregate.',night=True,extra='Static conceptual illustration. Not a complete anonymity claim.')

a=t(400,30,'Missing context',24,GOLD,500)+t(870,30,'Decision',24,GOLD,500)+t(1320,30,'Potential cost',24,RED,500)
a+=icon('ecosystem',90,135,92)+t(90,215,'Ecosystem',24,weight=500)
a+=line(165,135,230,135)+t(405,123,['Team execution','is hard to assess'],27)
a+=line(580,135,675,135)+icon('coins',735,135,75)+t(925,123,['Fund a team with','unresolved blind spots'],25)
a+=line(1100,135,1160,135)+t(1320,115,['Budget at risk','Better teams missed'],27,RED)
a+=rule(265)
a+=icon('builder',90,350,92)+t(90,430,'Builder',24,weight=500)
a+=line(165,350,230,350)+t(405,338,['Support and audit access','are hard to verify'],25)
a+=line(580,350,675,350)+icon('flag',735,350,75)+t(925,338,['Commit build time to','a mismatched program'],25)
a+=line(1100,350,1160,350)+t(1320,330,['Launch delays','Runway pressure'],27,RED)
a+=rule(455)+t(728,500,'The cost can grow after a grant is allocated or a team commits its build time.',27)
slide('Poor context can cost<br>both sides time and capital.',a,'Two causal paths connect missing context, a commitment decision and potential consequences for ecosystems and builders.','Potential consequences · hypotheses to validate, not measured losses or demonstrated Senyap impact.',extra='Urgency hypothesis, not a measured causal result. For an ecosystem, limited first-hand evidence about execution may lead to funding a poorly matched team, consuming scarce review attention and grant budget while stronger teams are overlooked. For a builder, hard-to-verify audit access and program support may lead to committing build time to a mismatched ecosystem, causing avoidable delays and pressure on remaining operating runway. Not every program or team experiences these consequences. No loss estimates, actual Senyap customer failures or guaranteed prevention are claimed. The product is intended to help investigate these risks before commitment. Whether private paid signals are useful remains to be validated.')

a=t(0,30,'Observed in program reports',25,GOLD,500,'start')+t(1050,30,'What this may cost',25,RED,500)
a+=icon('document',65,125,75)+t(140,95,'Quality sourcing risk',28,weight=500,anchor='start')
a+=t(140,137,['Questbook concern in Plurality review','20 Dec 2023'],23,'var(--muted)',anchor='start')
a+=line(620,125,740,125)+icon('ecosystem',810,125,70)+t(900,110,['Harder to identify strong teams','Review effort spent on weak fits'],25,anchor='start')
a+=rule(240)
a+=icon('chat',65,325,75)+t(140,292,'Fragmented communication',28,weight=500,anchor='start')
a+=t(140,334,['Funding delays and gaps in post-grant support','ARDC grant recommendations · 7 Mar 2025'],23,'var(--muted)',anchor='start')
a+=line(620,325,740,325)+icon('builder',810,325,70)+t(900,310,['Harder to plan execution','More time spent finding support'],25,anchor='start')
a+=rule(435)+t(0,485,'Reports establish workflow problems. The proposed consequences are inferences.',26,anchor='start')
slide('The workflow gaps are documented.<br>The decision costs can compound.',a,'Published sourcing and operational findings lead to explicitly inferred decision costs.','Senyap aims to surface context before commitment. Impact and willingness to pay remain unvalidated.',extra='Primary sources rechecked for this revision. Plurality Labs milestone 1 review was published 20 December 2023, not 2024. Its Questbook section reports sourcing enough quality grants as a potential program failure reason. ARDC report by Castle Labs and DefiLlama Research, 7 March 2025, describes fragmented Discord/Questbook communications, occasional disbursement delays and errors, and grantee interest in stronger post-funding collaboration and networking. The report also describes program successes and varied performance across domains. Right-hand consequences are product-team inferences, not causal findings or loss measurements from either source. Senyap does not itself fix disbursement systems or guarantee ecosystem support. It proposes additional first-hand decision context. These reports do not establish paid privacy demand or validate Senyap.')

a=t(0,38,'Side A',25,RED,500,'start')+node('ecosystem',225,115,'Ecosystem',['Pays for builder signals'],105)
a+=line(380,115,655,115)+line(790,115,1070,115)+icon('search',725,115,75,RED)
a+=t(725,57,'Find builders worth supporting',29,weight=500)+node('builder',1220,115,'Opt-in builders',size=105)
a+=rule(265)+t(0,310,'Side B',25,RED,500,'start')+node('builder',225,385,'Builder',['Pays for ecosystem signals'],105)
a+=line(380,385,655,385)+line(790,385,1070,385)+icon('search',725,385,75,RED)
a+=t(725,327,'Find ecosystems worth joining',29,weight=500)+node('ecosystem',1220,385,'Ecosystems',size=105)
slide('One market.<br>Two directions of discovery.',a,'Side A ecosystem searches builders. Side B builder searches ecosystems.','Side A · two-slot exclusivity auction, then flat access. Side B · flat access with bounded A subsidy.')

a=''
stages=[('shield','Join',['Credential +','private membership']),('lock','Back',['Encrypted pick','10–500 demo dUSD']),('scouts','Aggregate',['At least','five scouts']),('key','Open',['Buyer pays','Verified shares']),('flag','Resolve',['Private hit + claim','or eligible refund'])]
for i,(im,title,detail) in enumerate(stages):
    x=122+i*303
    a+=t(x,45,str(i+1),24,GOLD,600)+node(im,x,170,title,detail,112)
    if i<4:a+=line(x+83,170,x+219,170)
a+=rule(405)+t(728,465,'Eight options maximum · Three positions per scout',27)
slide('From private conviction<br>to a paid signal.',a,'Join, back, aggregate, open, resolve.','Staking provides an incentive. It does not guarantee that a signal is true.')

a=t(140,30,'Before',24,GOLD,500)+t(730,30,'With Senyap',24,GOLD,500)+t(730,67,'Access purchased',22)+t(1260,30,'Next decision',24,GOLD,500)
for j,name in enumerate(['A','B','C']):
    x=55+j*125
    a+=icon('builder',x,130,70)+t(x,200,'Team '+name,23)
a+=t(180,265,['Three opt-in teams','Similar application claims'],26)
a+=line(380,145,530,145)+icon('eye',720,120,90)
for y,name,width in [(225,'A',95),(275,'B',200),(325,'C',65)]:
    a+=t(580,y+8,name,23,anchor='start')+line(625,y,625+width,y,GOLD,False)
a+=t(720,390,['Stake-backed support','+ first-hand reasons'],25)
a+=line(910,145,1080,145)+node('chat',1260,145,'Interview Team B first',['Test the execution evidence'],115)
a+=rule(445)+t(728,493,'The signal guides due diligence. The ecosystem still makes the funding decision.',27)
slide('Which builder should<br>we investigate first?',a,'Applications from three opt-in teams lead to an opened aggregate, then a prioritized reference interview.','Illustrative Side A decision · synthetic support · no actual customer decision or pilot claimed.',new=True,extra='Hypothetical ecosystem sourcing example. A, B and C are synthetic teams. Diagram bars show invented relative support, not recorded weights, returns or a validated quality score. Assume the market meets its eligibility threshold and the buyer has authorized access to each displayed aggregate through auction or flat purchases. Stronger support suggests a reference interview, not automatic funding. No customer outcome or pilot is claimed.')

img='data:image/png;base64,'+base64.b64encode((ROOT/'deck-assets'/'purchases.png').read_bytes()).decode()
a=icon('coins',140,65,70)+t(220,58,'10 demo dUSD',27,weight=500,anchor='start')
a+=line(515,60,755,60)+icon('eye',850,60,70)+t(930,53,['Weight 235','One opened reason'],25,anchor='start')
art=svg(a,'A payment opens the recorded aggregate and reason.',145)+f'<div class="ui-frame"><img src="{img}" alt="Recorded market 7 purchase"></div>'
slide('The buyer opens<br>a real product result.',art,'','Market #7 · owner browser purchase · synthetic content. Full settled lifecycle uses market #3.',raw=True)

a=node('browser',175,65,'Web app',['React · Vite · TypeScript'],82)
a+=line(300,65,565,65)+t(432,35,'Sign + submit',22)+node('key',710,65,'Lace + Midnight.js',['Typed SDK · receipt recovery'],82)
a+=line(835,65,1110,65)+node('chain',1265,65,'Midnight Preprod',['Compact · 52 circuits · dUSD'],82)
a+=line(1265,197,1265,300)+t(1340,250,'State',22)
a+=node('document',1280,350,'RPC + indexer',['Verified metadata'],78)
a+=p('M1330 350H1420V230H330V95H235',dashed=True)+t(570,217,'Live reads + receipts',22)
a+=p('M130 65H30V350H115')+node('proof',175,350,'Local proof server',['Private witnesses'],78)
a+=node('filter',610,350,'Operator + relay',['Reclaim · Gemini'],78)+p('M1000 65V265H610V298')
a+=line(710,350,870,350)+t(790,320,'Delivery',22)+icon('scouts',950,350,78)+t(950,429,'3-of-5 committee',25,weight=500)
slide('Every component<br>has an explicit job.',a,'App, wallet, chain, reads, proofs, reason operator and committee services.','Local services handle sensitive data. Heavy proving is not entirely in the browser.')

a=node('lock',170,130,'Private witness',['Membership secret','Chosen option'],125)
a+=line(300,130,565,130)+t(435,95,'Prove the rules',24)
a+=node('proof',725,130,'Compact + ZK proof',['Eligible member','Valid stake and state update'],125,RED)
a+=line(855,130,1100,130)+t(975,95,'Verify the proof',24)
a+=node('chain',1270,130,'Public ledger',['Accept valid transition','Reject invalid transition'],125)
a+=rule(355)+icon('shield',65,430,65)+t(130,417,'Why Midnight',30,weight=500,anchor='start')
a+=t(130,462,'Verify market rules without publishing the scout’s private pick or membership secret.',27,anchor='start')
slide('Why Midnight?<br>Prove the rules. Keep the pick private.',a,'Private witness becomes a ZK proof whose state transition can be verified on the public ledger.','Privacy is selective · demo funding wallets and amounts remain public. Operator and prover trust still apply.',new=True,extra='Technology rationale grounded in the existing Senyap Compact contract. Private membership and stake witnesses are consumed by zero-knowledge circuits, while the ledger verifies proofs and state transitions. The chosen option is encrypted and its validity is checked without publishing the plaintext choice or membership secret. Nullifiers and lifecycle/payment constraints support accountable participation. Midnight does not itself guarantee truth, private reason handling, independent threshold operation or network anonymity. Heavy local proving exposes the witness to the local prover. Unshielded dUSD wallets and amounts remain public.')

a=node('shield',150,130,'Prove membership',['Scoped nullifiers','Block reuse'],110)
a+=line(270,130,550,130)+t(410,96,'Private pick',23)+node('lock',690,130,'Encrypted tally',['Bounded aggregate','No public chosen option'],125)
a+=line(815,130,1115,130)+t(960,96,'Paid access',23)
for i in range(5):a+=icon('key',1160+i*53,95,38,GOLD if i<3 else '#CDBFBF')
a+=t(1265,218,'3-of-5 delivery',29,weight=500)+t(1265,257,['Buyer-bound shares','DLEQ checked off-chain'],23,'var(--muted)')
a+=rule(365)+t(0,420,'Joint Shamir key generation + Feldman-style commitments',28,anchor='start')
a+=t(0,467,'Reclaim proves logged-in access, not contribution count or full Sybil resistance.',23,'var(--muted)',anchor='start')
slide('Private inputs.<br>Verifiable state changes.',a,'ZK membership, encrypted aggregate and three threshold decryption shares.','Wrong-share slashing is not enforced. Three colluding shares can decrypt.',night=True)

a=''
for x,num,label,im in [(165,'52','Contract circuits','proof'),(710,'157','Finalized actions','receipt'),(1260,'7','Side B markets','ecosystem')]:
    a+=icon(im,x-100,75,70)+t(x+25,110,num,92,weight=800)+t(x+25,155,label,25)
a+=t(0,245,'Market #3 · completed Side B lifecycle',30,weight=500,anchor='start')
xs=[70,255,440,625,810,995,1180,1370]
for i,(x,im,label) in enumerate(zip(xs,['document','coins','lock','scouts','key','flag','proof','receipt'],['Create','5 stakes','Close','Preview','Purchase','Outcome','5 hits','5 claims'])):
    a+=icon(im,x,330,62)+t(x,400,label,23)
    if i<7:a+=line(x+43,330,xs[i+1]-43,330)
slide('Deployed.<br>Executed and traceable.',a,'Network counts and the completed market 3 receipt sequence.','19 Oct snapshot · actions are not users. Owner-controlled seats and synthetic scout identities.')

a=t(155,28,'Failure injected',24,GOLD)+t(728,28,'Expected behavior',24,GOLD)+t(1270,28,'Evidence',24,GOLD)
for y,im,title,guard in [(105,'replay','Replay or malformed share','Reject the invalid input'),(240,'clock','Missing or late receipt','Keep uncertainty explicit'),(375,'cancel','Expired or wrong-role action','Block the action safely')]:
    a+=icon(im,65,y,63,RED)+t(145,y+9,title,25,anchor='start')
    a+=line(485,y,570,y)+icon('shield',635,y,60)+t(690,y+9,guard,25,anchor='start')
    a+=line(1055,y,1135,y)+icon('check',1210,y,55)+t(1285,y+9,'Tested',25,anchor='start')
a+=rule(440)+t(728,495,'44 focused tests / 11 files passed    ·    Full CI / 66 test files passed',28,weight=500)
slide('QA exercises the ways<br>this product can fail.',a,'Failures flow through expected guards into regression evidence.','Simulator, HTTP and frontend tests · integration journals · no independent security audit.')

a=t(0,25,'Historical full cycle · r10',28,weight=500,anchor='start')+t(0,64,'42 circuits · source 4f1b3390 · 84 actions',22,'var(--muted)',anchor='start')
a+=icon('coins',100,190,95)+t(100,278,'1,240 in',32,weight=600)
a+=p('M170 190H265V120H355')+p('M265 190V280H355')+p('M265 190V420H355')
for y,im,num,label in [(120,'receipt','1,120','Claims'),(280,'refund','100','Refund'),(420,'coins','20','Remainder')]:
    a+=icon(im,410,y,65)+t(480,y-4,num,33,weight=600,anchor='start')+t(480,y+33,label,23,'var(--muted)',anchor='start')
a+=line(680,0,680,490,LINE,False)+t(760,25,'Current cancellation cycle · short-s2',28,weight=500,anchor='start')
a+=t(760,64,'52 circuits · source edb4251f · 67 transactions',22,'var(--muted)',anchor='start')
a+=node('cancel',870,190,'Cancelled',size=90,color=RED)+line(965,190,1130,190)+node('refund',1280,190,'500 refunded',size=90)
a+=icon('check',805,365,43)+t(850,374,'Public intent + opt-out',25,anchor='start')
a+=icon('check',805,430,43)+t(850,439,'Leaked-share seizure · 1,750 retained',25,anchor='start')
slide('Follow the money.<br>Keep test versions visible.',a,'Historical settlement conservation versus current cancellation evidence.','Historical run settled both sides. Current short run demonstrates cancellation and enforcement.')

a=node('coins',160,100,'Funding wallets',['Wallet + amounts','Public on the ledger'],115)
a+=node('eye',720,100,'Reason operator',['Operator + Gemini','See reason text'],115)
a+=node('key',1290,100,'Committee',['Three shares','Can decrypt'],115)
a+=p('M160 310V350H1290V310',arrow=False)+p('M720 310V350',arrow=False)
a+=icon('scouts',325,425,70,RED)+t(400,418,'One owner controls the demo services',31,weight=500,anchor='start')
a+=t(400,462,'Independent operation is still to come',24,'var(--muted)',anchor='start')
slide('Privacy has boundaries.<br>Show who can see what.',a,'Public funding, reason access and committee collusion are visible trust boundaries.','Local prover sees heavy-circuit witnesses. No network anonymity claim or independent audit.')

a=node('buyer',130,155,'Signal buyer',['Side A or Side B'],115)+line(245,155,480,155)+t(360,116,'Pays for access',24)
a+=icon('coins',560,155,115)+t(560,275,'Access revenue',29,weight=500)
a+=p('M645 155H760V75H1020')+p('M760 155V300H1020')
a+=icon('scouts',1100,75,85)+t(1190,78,'85%',75,weight=800,anchor='start')+t(1190,125,'Scout rewards',25,anchor='start')
a+=icon('server',1100,300,85)+t(1190,303,'15%',75,weight=800,anchor='start')+t(1190,350,'Platform allocation',25,anchor='start')
a+=rule(410)+t(0,472,'Side A can support Side B with up to five percentage points of revenue.',27,anchor='start')
slide('Buyers fund access.<br>Scouts share the upside.',a,'Buyer payment branches to 85 percent scout rewards and 15 percent platform allocation.','Pricing and allocation are hypotheses. Demo dUSD is a test token. No paying customers claimed.')

a=''
for i,(x,im,title,detail) in enumerate([(210,'chat','Validate the need',['Builder + ecosystem interviews','Which decision changes?']),(725,'scouts','Separate the operators',['Committee independence','Review reason privacy']),(1240,'search','Run an opt-in pilot',['Signal usefulness + purchase intent','Repeat use'])]):
    a+=node(im,x,105,title,detail,110)
    if i<2:a+=line(x+100,105,x+410,105)
a+=rule(325)+t(0,373,'Prior work, disclosed',25,GOLD,500,'start')
a+=t(0,427,'Bisik · Solana / Colosseum',27,weight=500,anchor='start')+t(0,466,'Idea + market mechanism',23,'var(--muted)',anchor='start')
a+=line(470,420,835,420)+t(650,390,'Carried forward',22)
a+=t(900,427,'Senyap · Midnight / Wave 2',27,weight=500,anchor='start')+t(900,466,'New Midnight implementation',23,'var(--muted)',anchor='start')
slide('Next, make the signal<br>useful in an opt-in pilot.',a,'Validate demand, separate operations, run a pilot. Prior mechanism came from Bisik.','No pilot claimed. Solana, Arcium and Semaphore code is absent from this repository.')

a=node('scouts',200,150,'Private conviction',size=140)+line(325,150,610,150)+node('shield',730,150,'Accountable stakes',size=155,color=RED)
a+=line(860,150,1140,150)+node('signal',1260,150,'Useful aggregate',size=140)
a+=t(728,390,'A working Midnight Preprod prototype',32,GOLD,500)+t(728,458,'github.com/scientivan/senyap',27,'var(--muted)')
slide('A signal worth opening.<br>A source worth protecting.',a,'Private conviction becomes a useful aggregate through accountable stakes.','Product · engineering · QA · UX · business',night=True)

a=''
refs=[('document','Problem evidence',['Plurality Labs · milestone 1 review (2023)','ARDC · DAO grant recommendations (2025)'],'https://forum.arbitrum.foundation/t/plurality-labs-milestone-1-review/20198'),('chain','Network + implementation',['github.com/scientivan/senyap','README + Preprod receipts + transaction snapshot'],'https://github.com/scientivan/senyap'),('check','QA + versioned runs',['GitHub Actions · run 39196182087','Focused QA + local lifecycle journals'],'https://github.com/scientivan/senyap/actions/runs/39196182087')]
for i,(im,title,detail,url) in enumerate(refs):
    y=75+i*165
    a+=icon(im,60,y,75)+t(140,y-12,title,29,weight=500,anchor='start')
    if im=='document':
        a+=f'<a href="{escape(url)}">'+t(630,y-15,detail[0],25,'var(--muted)',anchor='start')+'</a>'
        a+='<a href="https://forum.arbitrum.foundation/t/recommendations-for-improving-the-dao-s-grant-programs/28645">'+t(630,y+19,detail[1],25,'var(--muted)',anchor='start')+'</a>'
    else:
        a+=f'<a href="{escape(url)}">'+t(630,y-15,detail,25,'var(--muted)',anchor='start')+'</a>'
    if i<2:a+=rule(y+95)
slide('Evidence you can inspect.',a,'Source map for problem evidence, network and quality assurance.','Evidence snapshot · 19 Oct 2026 · repository access depends on owner publication.')

css='''
*{box-sizing:border-box}html,body{margin:0;background:#EBE7E7;color:#2A1B1B;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',Inter,'Helvetica Neue',sans-serif}.page{--ink:#2A1B1B;--muted:#5B4646;width:1600px;height:900px;background:white;position:relative;overflow:hidden;page-break-after:always;padding:44px 72px 45px}.night{--ink:#F4EFEF;--muted:#CDBFBF;background:#2A1B1B;color:#F4EFEF;background-image:radial-gradient(#4A3434 1px,transparent 1px);background-size:32px 32px}header,footer{display:flex;justify-content:space-between;align-items:center;font-size:18px;font-weight:500}header{height:38px}header>span:last-child{color:var(--muted)}.brand{font-size:26px;display:flex;align-items:center;gap:5px}.brand i,.brand b,.brand em{display:inline-block;width:5px;border-radius:3px;background:#AE9970;height:23px}.brand b{height:16px;background:#C1272D}.brand em{height:9px;background:#A50C22;margin-right:10px}main{margin-top:30px}h1{font-size:66px;line-height:1.04;letter-spacing:-.035em;font-weight:300;margin:0 0 22px;min-height:138px}.diagram{display:block;width:1456px;height:auto;overflow:visible}.diagram text{font-family:inherit;letter-spacing:-.015em}.caption{font-size:21px;line-height:1.4;margin:7px 0 0;color:var(--muted);text-align:left}footer{position:absolute;bottom:30px;left:72px;right:72px;font-size:17px;color:var(--muted)}.ui-frame{border:1px solid #E4DFDF;border-radius:12px;height:335px;overflow:hidden}.ui-frame img{width:2000px;max-width:none;display:block;margin-left:-310px;margin-top:-2px}@page{size:1600px 900px;margin:0}@media print{html,body{background:white}.page{break-after:page}}
'''
(ROOT/'senyap-deck.html').write_text('<!DOCTYPE html><html lang="en"><meta charset="utf-8"><title>Senyap · Illustrated Deck</title><style>'+css+'</style><body>'+''.join(slides)+'</body></html>')
(ROOT/'deck-outline.md').write_text('# Senyap illustrated deck\n\n18 slides. Includes the decision example and Midnight rationale requested by Dien.\n\n'+'\n'.join(f'{i+1}. '+unescape(re.search('data-label="([^"]*)"',s).group(1)) for i,s in enumerate(slides))+'\n\nStatic SVG illustrations and directed flows replace explanatory card grids. Full evidence qualifications are preserved in presenter notes, with important limits still visible. No presentation buttons.\n')
print(json.dumps({'slides':len(slides),'explanatoryCards':0,'presentationButtons':0,'staticVectorIllustrations':True}))
